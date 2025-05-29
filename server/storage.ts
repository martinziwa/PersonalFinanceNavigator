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

export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Transactions
  getTransactions(userId: string): Promise<Transaction[]>;
  getTransactionsByCategory(userId: string, category: string): Promise<Transaction[]>;
  createTransaction(userId: string, transaction: InsertTransaction): Promise<Transaction>;
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

  async deleteTransaction(userId: string, id: number): Promise<void> {
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  // Budgets
  async getBudgets(userId: string): Promise<Budget[]> {
    return await db.select().from(budgets).where(eq(budgets.userId, userId)).orderBy(budgets.category);
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

    // Get savings goals total
    const userSavingsGoals = await db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId));
    const totalSavings = userSavingsGoals.reduce((sum, goal) => sum + parseFloat(goal.currentAmount), 0);

    // Get total debt from loans
    const userLoans = await db.select().from(loans).where(eq(loans.userId, userId));
    const totalDebt = userLoans.reduce((sum, loan) => sum + parseFloat(loan.balance), 0);

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