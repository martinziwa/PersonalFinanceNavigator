import {
  transactions,
  budgets,
  savingsGoals,
  loans,
  users,
  type Transaction,
  type InsertTransaction,
  type Budget,
  type InsertBudget,
  type SavingsGoal,
  type InsertSavingsGoal,
  type Loan,
  type InsertLoan,
  type User,
  type UpsertUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Transactions
  getTransactions(userId: string): Promise<Transaction[]>;
  getTransactionsByCategory(userId: string, category: string): Promise<Transaction[]>;
  createTransaction(userId: string, transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(userId: string, id: number, transaction: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(userId: string, id: number): Promise<void>;

  // Budgets
  getBudgets(userId: string): Promise<Budget[]>;
  getBudget(userId: string, id: number): Promise<Budget | undefined>;
  createBudget(userId: string, budget: InsertBudget): Promise<Budget>;
  updateBudget(userId: string, id: number, budget: Partial<Budget>): Promise<Budget>;
  deleteBudget(userId: string, id: number): Promise<void>;

  // Savings Goals
  getSavingsGoals(userId: string): Promise<SavingsGoal[]>;
  getSavingsGoal(userId: string, id: number): Promise<SavingsGoal | undefined>;
  createSavingsGoal(userId: string, goal: InsertSavingsGoal): Promise<SavingsGoal>;
  updateSavingsGoal(userId: string, id: number, goal: Partial<SavingsGoal>): Promise<SavingsGoal>;
  deleteSavingsGoal(userId: string, id: number): Promise<void>;

  // Loans
  getLoans(userId: string): Promise<Loan[]>;
  getLoan(userId: string, id: number): Promise<Loan | undefined>;
  createLoan(userId: string, loan: InsertLoan): Promise<Loan>;
  updateLoan(userId: string, id: number, loan: Partial<Loan>): Promise<Loan>;
  deleteLoan(userId: string, id: number): Promise<void>;
  calculateLoanInterest(loan: Loan): Promise<{
    totalInterest: number;
    currentBalance: number;
    monthlyPayment: number;
    payoffDate: Date | null;
  }>;

  // Financial Summary
  getFinancialSummary(userId: string): Promise<{
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Helper method to calculate amortized monthly payment
  private calculateAmortizedPayment(principal: number, annualRate: number, termMonths: number): number {
    if (annualRate === 0) {
      // If no interest, simply divide principal by term
      return principal / termMonths;
    }
    
    const monthlyRate = annualRate / 100 / 12; // Convert annual percentage to monthly decimal
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                   (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    return payment;
  }

  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Transactions
  async getTransactions(userId: string): Promise<Transaction[]> {
    const result = await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(transactions.date);
    return result.reverse();
  }

  async getTransactionsByCategory(userId: string, category: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.category, category)));
  }

  async createTransaction(userId: string, insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values({ ...insertTransaction, userId })
      .returning();

    // Update budget spent amount if it's an expense or loan payment and within budget period
    if (transaction.type === "expense" || transaction.type === "loan_payment") {
      const matchingBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.category, transaction.category),
            lte(budgets.startDate, transaction.date),
            gte(budgets.endDate, transaction.date)
          )
        );

      for (const budget of matchingBudgets) {
        const newSpent = parseFloat(budget.spent) + parseFloat(transaction.amount);
        await db
          .update(budgets)
          .set({ spent: newSpent.toString() })
          .where(eq(budgets.id, budget.id));
      }
    }

    return transaction;
  }

  async updateTransaction(userId: string, id: number, updates: Partial<InsertTransaction>): Promise<Transaction> {
    const [transaction] = await db
      .update(transactions)
      .set(updates)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return transaction;
  }

  async deleteTransaction(userId: string, id: number): Promise<void> {
    const [transaction] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    
    if (transaction && (transaction.type === "expense" || transaction.type === "loan_payment")) {
      // Update budget spent amount if within budget period
      const matchingBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.category, transaction.category),
            lte(budgets.startDate, transaction.date),
            gte(budgets.endDate, transaction.date)
          )
        );

      for (const budget of matchingBudgets) {
        const newSpent = parseFloat(budget.spent) - parseFloat(transaction.amount);
        await db
          .update(budgets)
          .set({ spent: Math.max(0, newSpent).toString() })
          .where(eq(budgets.id, budget.id));
      }
    }
    
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  // Budgets
  async getBudgets(userId: string): Promise<Budget[]> {
    return await db.select().from(budgets).where(eq(budgets.userId, userId));
  }

  async getBudget(userId: string, id: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
    return budget || undefined;
  }

  async createBudget(userId: string, insertBudget: InsertBudget): Promise<Budget> {
    const [budget] = await db
      .insert(budgets)
      .values({ ...insertBudget, userId })
      .returning();
    return budget;
  }

  async updateBudget(userId: string, id: number, updates: Partial<Budget>): Promise<Budget> {
    const [updated] = await db
      .update(budgets)
      .set(updates)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    
    if (!updated) {
      throw new Error("Budget not found");
    }
    return updated;
  }

  async deleteBudget(userId: string, id: number): Promise<void> {
    await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  }

  // Savings Goals
  async getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    return await db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId));
  }

  async getSavingsGoal(userId: string, id: number): Promise<SavingsGoal | undefined> {
    const [goal] = await db.select().from(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
    return goal || undefined;
  }

  async createSavingsGoal(userId: string, insertGoal: InsertSavingsGoal): Promise<SavingsGoal> {
    const [goal] = await db
      .insert(savingsGoals)
      .values({ ...insertGoal, userId })
      .returning();
    return goal;
  }

  async updateSavingsGoal(userId: string, id: number, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const [updated] = await db
      .update(savingsGoals)
      .set(updates)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .returning();
    
    if (!updated) {
      throw new Error("Savings goal not found");
    }
    return updated;
  }

  async deleteSavingsGoal(userId: string, id: number): Promise<void> {
    await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  }

  // Loans
  async getLoans(userId: string): Promise<Loan[]> {
    return await db.select().from(loans).where(eq(loans.userId, userId));
  }

  async getLoan(userId: string, id: number): Promise<Loan | undefined> {
    const [loan] = await db.select().from(loans).where(and(eq(loans.id, id), eq(loans.userId, userId)));
    return loan;
  }

  async createLoan(userId: string, insertLoan: InsertLoan): Promise<Loan> {
    // Calculate monthly payment using full amortization
    const monthlyPayment = this.calculateAmortizedPayment(
      parseFloat(insertLoan.principal),
      parseFloat(insertLoan.interestRate || "0"),
      insertLoan.termMonths
    );

    const [loan] = await db
      .insert(loans)
      .values({ 
        ...insertLoan, 
        userId,
        monthlyPayment: monthlyPayment.toFixed(2)
      })
      .returning();
    return loan;
  }

  async updateLoan(userId: string, id: number, updates: Partial<Loan>): Promise<Loan> {
    // If key loan parameters are being updated, recalculate monthly payment
    if (updates.principal || updates.interestRate || updates.termMonths) {
      const currentLoan = await this.getLoan(userId, id);
      if (currentLoan) {
        const principal = parseFloat(updates.principal || currentLoan.principal);
        const interestRate = parseFloat(updates.interestRate || currentLoan.interestRate);
        const termMonths = updates.termMonths || currentLoan.termMonths;
        
        const monthlyPayment = this.calculateAmortizedPayment(principal, interestRate, termMonths);
        updates.monthlyPayment = monthlyPayment.toFixed(2);
      }
    }

    const [loan] = await db
      .update(loans)
      .set(updates)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .returning();
    return loan;
  }

  async deleteLoan(userId: string, id: number): Promise<void> {
    await db.delete(loans).where(and(eq(loans.id, id), eq(loans.userId, userId)));
  }

  async calculateLoanInterest(loan: Loan): Promise<{
    totalInterest: number;
    currentBalance: number;
    monthlyPayment: number;
    payoffDate: Date | null;
  }> {
    const principal = parseFloat(loan.principal);
    const currentBalance = parseFloat(loan.currentBalance);
    const annualRate = parseFloat(loan.interestRate) / 100;
    const monthlyPayment = parseFloat(loan.monthlyPayment || "0");
    const now = new Date();
    
    let totalInterest = 0;
    let payoffDate: Date | null = null;
    
    // For amortized loans with monthly payments
    if (monthlyPayment > 0) {
      const monthlyRate = annualRate / 12;
      
      if (monthlyRate > 0) {
        // Calculate remaining months to pay off the loan
        const remainingMonths = Math.ceil(
          -Math.log(1 - (currentBalance * monthlyRate) / monthlyPayment) / 
          Math.log(1 + monthlyRate)
        );
        
        if (remainingMonths > 0 && isFinite(remainingMonths)) {
          // Calculate total interest that will be paid
          totalInterest = (monthlyPayment * remainingMonths) - currentBalance;
          
          // Calculate payoff date
          payoffDate = new Date(now);
          payoffDate.setMonth(payoffDate.getMonth() + remainingMonths);
        }
      } else {
        // No interest case
        const remainingMonths = Math.ceil(currentBalance / monthlyPayment);
        payoffDate = new Date(now);
        payoffDate.setMonth(payoffDate.getMonth() + remainingMonths);
      }
    }
    
    return {
      totalInterest: Math.max(0, totalInterest),
      currentBalance,
      monthlyPayment,
      payoffDate
    };
  }

  // Financial Summary
  async getFinancialSummary(userId: string): Promise<{
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthlyTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startOfMonth),
          lte(transactions.date, endOfMonth)
        )
      );

    const monthlyIncome = monthlyTransactions
      .filter(t => parseFloat(t.amount) > 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const monthlyExpenses = monthlyTransactions
      .filter(t => parseFloat(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    // Get all user transactions for total calculations
    const allUserTransactions = await this.getTransactions(userId);

    // Get savings goals
    const userSavingsGoals = await this.getSavingsGoals(userId);
    let totalSavings = 0;
    
    for (const goal of userSavingsGoals) {
      // Calculate saved amount for each goal
      const goalTransactions = allUserTransactions.filter(transaction => 
        transaction.description?.toLowerCase().includes(goal.name.toLowerCase()) ||
        transaction.category === 'savings'
      );
      
      const goalSavings = goalTransactions
        .filter(t => parseFloat(t.amount) > 0)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      totalSavings += goalSavings;
    }

    // Get loans for debt calculation
    const userLoans = await this.getLoans(userId);
    const totalDebt = userLoans.reduce((sum, loan) => {
      return sum + parseFloat(loan.currentBalance);
    }, 0);

    // Calculate net worth (simplified as savings - debt)
    const netWorth = totalSavings - totalDebt;

    return {
      netWorth,
      monthlyIncome,
      monthlyExpenses,
      totalSavings,
      totalDebt
    };
  }
}

export const storage = new DatabaseStorage();