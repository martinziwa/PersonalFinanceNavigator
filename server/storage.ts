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
import { eq, and, gte, lte, sum } from "drizzle-orm";
import { desc } from "drizzle-orm";

// Helper function to convert frequency string to compounding periods per year
function getCompoundingFrequency(frequency: string): number {
  switch (frequency.toLowerCase()) {
    case "daily": return 365;
    case "weekly": return 52;
    case "biweekly": return 26;
    case "monthly": return 12;
    case "bimonthly": return 6;
    case "quarterly": return 4;
    case "annually": return 1;
    default: return 12; // Default to monthly
  }
}

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
    return await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.category, category))).orderBy(transactions.date);
  }

  async createTransaction(userId: string, insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values({...insertTransaction, userId})
      .returning();
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
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  // Budgets
  async getBudgets(userId: string): Promise<Budget[]> {
    const budgetsData = await db.select().from(budgets).where(eq(budgets.userId, userId)).orderBy(desc(budgets.startDate), budgets.category);
    
    // Calculate actual spending for each budget from transactions
    const budgetsWithSpending = await Promise.all(
      budgetsData.map(async (budget) => {
        // Get transactions that match this budget's category and fall within its date range
        const budgetTransactions = await db
          .select()
          .from(transactions)
          .where(and(
            eq(transactions.userId, userId),
            eq(transactions.category, budget.category),
            eq(transactions.type, 'expense'),
            gte(transactions.date, budget.startDate),
            lte(transactions.date, budget.endDate)
          ));
        
        // Calculate total spent from matching transactions
        const totalSpent = budgetTransactions.reduce((sum, transaction) => {
          return sum + parseFloat(transaction.amount);
        }, 0);
        
        return {
          ...budget,
          spent: totalSpent.toFixed(2)
        };
      })
    );
    
    return budgetsWithSpending;
  }

  async getBudget(userId: string, id: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
    
    if (!budget) return undefined;
    
    // Calculate actual spending for this budget from transactions
    const budgetTransactions = await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.category, budget.category),
        eq(transactions.type, 'expense'),
        gte(transactions.date, budget.startDate),
        lte(transactions.date, budget.endDate)
      ));
    
    // Calculate total spent from matching transactions
    const totalSpent = budgetTransactions.reduce((sum, transaction) => {
      return sum + parseFloat(transaction.amount);
    }, 0);
    
    return {
      ...budget,
      spent: totalSpent.toFixed(2)
    };
  }

  async createBudget(userId: string, insertBudget: InsertBudget): Promise<Budget> {
    const [budget] = await db
      .insert(budgets)
      .values({...insertBudget, userId})
      .returning();
    return budget;
  }

  async updateBudget(userId: string, id: number, updates: Partial<Budget>): Promise<Budget> {
    const [budget] = await db
      .update(budgets)
      .set(updates)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return budget;
  }

  async deleteBudget(userId: string, id: number): Promise<void> {
    await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  }

  // Savings Goals
  async getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    return await db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)).orderBy(savingsGoals.name);
  }

  async getSavingsGoal(userId: string, id: number): Promise<SavingsGoal | undefined> {
    const [goal] = await db.select().from(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
    return goal;
  }

  async createSavingsGoal(userId: string, insertGoal: InsertSavingsGoal): Promise<SavingsGoal> {
    const [goal] = await db
      .insert(savingsGoals)
      .values({...insertGoal, userId})
      .returning();
    return goal;
  }

  async updateSavingsGoal(userId: string, id: number, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const [goal] = await db
      .update(savingsGoals)
      .set(updates)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .returning();
    return goal;
  }

  async deleteSavingsGoal(userId: string, id: number): Promise<void> {
    await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  }

  // Loans
  async getLoans(userId: string): Promise<Loan[]> {
    return await db.select().from(loans).where(eq(loans.userId, userId)).orderBy(desc(loans.id));
  }

  async getLoan(userId: string, id: number): Promise<Loan | undefined> {
    const [loan] = await db.select().from(loans).where(and(eq(loans.id, id), eq(loans.userId, userId)));
    return loan;
  }

  async createLoan(userId: string, insertLoan: InsertLoan): Promise<Loan> {
    // Calculate monthly payment using full amortization
    const monthlyPayment = this.calculateAmortizedPayment(
      parseFloat(insertLoan.principal),
      parseFloat(insertLoan.interestRate),
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
    const startDate = new Date(loan.startDate);
    const now = new Date();
    
    // Calculate time elapsed in years
    const timeElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    let totalInterest = 0;
    let calculatedBalance = currentBalance;
    let monthlyPayment = 0;
    let payoffDate: Date | null = null;

    if (loan.interestType === "simple") {
      // Simple Interest: I = P * r * t
      totalInterest = principal * annualRate * timeElapsed;
      calculatedBalance = principal + totalInterest;
      
      if (loan.monthlyPayment && parseFloat(loan.monthlyPayment) > 0) {
        monthlyPayment = parseFloat(loan.monthlyPayment);
        const monthsToPayoff = calculatedBalance / monthlyPayment;
        payoffDate = new Date(now.getTime() + (monthsToPayoff * 30 * 24 * 60 * 60 * 1000));
      }
    } else {
      // Compound Interest: A = P(1 + r/n)^(nt)
      const frequency = getCompoundingFrequency(loan.compoundFrequency || 'monthly');
      const compoundAmount = principal * Math.pow(1 + (annualRate / frequency), frequency * timeElapsed);
      totalInterest = compoundAmount - principal;
      calculatedBalance = compoundAmount;
      
      if (loan.monthlyPayment && parseFloat(loan.monthlyPayment) > 0) {
        monthlyPayment = parseFloat(loan.monthlyPayment);
        // Approximate calculation for compound interest payoff
        const monthlyRate = annualRate / 12;
        const monthsToPayoff = -Math.log(1 - (calculatedBalance * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate);
        if (monthsToPayoff > 0 && isFinite(monthsToPayoff)) {
          payoffDate = new Date(now.getTime() + (monthsToPayoff * 30 * 24 * 60 * 60 * 1000));
        }
      }
    }

    return {
      totalInterest,
      currentBalance: calculatedBalance,
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
    // Get current month's transactions
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyTransactions = await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        gte(transactions.date, startOfMonth),
        lte(transactions.date, endOfMonth)
      ));

    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const monthlyExpenses = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Get all transactions for calculations
    const allUserTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));

    // Get savings goals total - calculate actual progress from transactions
    const userSavingsGoals = await db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId));
    let totalSavings = 0;
    
    for (const goal of userSavingsGoals) {
      // Start with initial current amount AND starting savings
      let goalProgress = parseFloat(goal.currentAmount);
      const startingSavings = parseFloat(goal.startingSavings || '0');
      goalProgress += startingSavings;
      
      // Add savings deposits and subtract withdrawals for this goal
      const goalTransactions = allUserTransactions.filter((t: any) => t.savingsGoalId === goal.id);
      
      const transactionTotal = goalTransactions.reduce((sum: number, t: any) => {
        if (t.type === 'savings_deposit') {
          return sum + parseFloat(t.amount);
        } else if (t.type === 'savings_withdrawal') {
          return sum - parseFloat(t.amount);
        }
        return sum;
      }, 0);
      
      goalProgress += transactionTotal;
      totalSavings += goalProgress;
    }

    // Get total debt from loans
    const userLoans = await db.select().from(loans).where(eq(loans.userId, userId));
    const totalDebt = userLoans.reduce((sum, loan) => {
      return sum + parseFloat(loan.currentBalance);
    }, 0);

    // Calculate net worth (assets - debt)
    const netWorth = totalSavings - totalDebt;

    return {
      netWorth,
      monthlyIncome,
      monthlyExpenses,
      totalSavings,
      totalDebt,
    };
  }
}

export const storage = new DatabaseStorage();