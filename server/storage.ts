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
    return await db.select().from(budgets).where(eq(budgets.userId, userId)).orderBy(desc(budgets.startDate), budgets.category);
  }

  async getBudget(userId: string, id: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
    return budget;
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
    return await db.select().from(loans).where(eq(loans.userId, userId)).orderBy(loans.name);
  }

  async getLoan(userId: string, id: number): Promise<Loan | undefined> {
    const [loan] = await db.select().from(loans).where(and(eq(loans.id, id), eq(loans.userId, userId)));
    return loan;
  }

  async createLoan(userId: string, insertLoan: InsertLoan): Promise<Loan> {
    const [loan] = await db
      .insert(loans)
      .values({...insertLoan, userId})
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

    // Get total debt from loans and adjust for loan payments
    const userLoans = await db.select().from(loans).where(eq(loans.userId, userId));
    let totalDebt = 0;
    
    for (const loan of userLoans) {
      // Start with original loan balance
      let remainingBalance = parseFloat(loan.balance);
      
      // Subtract loan payments made for this loan
      const loanPayments = allUserTransactions.filter((t: any) => 
        t.loanId === loan.id && t.type === 'loan_payment'
      );
      
      const totalPayments = loanPayments.reduce((sum: number, t: any) => {
        return sum + parseFloat(t.amount);
      }, 0);
      
      // Add loan receipts (increases debt)
      const loanReceipts = allUserTransactions.filter((t: any) => 
        t.loanId === loan.id && t.type === 'loan_received'
      );
      
      const totalReceipts = loanReceipts.reduce((sum: number, t: any) => {
        return sum + parseFloat(t.amount);
      }, 0);
      
      // Calculate accumulated interest based on time elapsed and compounding frequency
      const interestRate = parseFloat(loan.interestRate) / 100; // Convert percentage to decimal
      const principalAmount = parseFloat(loan.principalAmount || loan.balance);
      
      // Calculate time elapsed since loan creation (assuming loan was created when it was added)
      // In a real app, you'd store the loan creation date
      const currentDate = new Date();
      const loanCreationDate = new Date(currentDate); // Fallback to current date
      loanCreationDate.setFullYear(currentDate.getFullYear() - 1); // Assume 1 year ago for demo
      
      const timeElapsedDays = Math.max(1, Math.floor((currentDate.getTime() - loanCreationDate.getTime()) / (1000 * 60 * 60 * 24)));
      const timeElapsedYears = timeElapsedDays / 365;
      
      let accumulatedInterest = 0;
      
      if (loan.interestType === 'simple') {
        // Simple interest: Principal × Rate × Time
        accumulatedInterest = principalAmount * interestRate * timeElapsedYears;
      } else {
        // Compound interest: A = P(1 + r/n)^(nt) - P
        const compoundingFrequency = getCompoundingFrequency(loan.interestPeriod || 'monthly');
        const compoundedAmount = principalAmount * Math.pow(
          (1 + interestRate / compoundingFrequency), 
          compoundingFrequency * timeElapsedYears
        );
        accumulatedInterest = compoundedAmount - principalAmount;
      }
      
      // Adjust balance: original + receipts - payments + accumulated interest
      remainingBalance = remainingBalance + totalReceipts - totalPayments + accumulatedInterest;
      totalDebt += Math.max(0, remainingBalance); // Don't allow negative debt
    }

    // Calculate net worth only from savings and loans (excluding income/expenses)
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