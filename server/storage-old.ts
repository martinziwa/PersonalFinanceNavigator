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

  async getTransactionsByCategory(category: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.category, category));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();

    // Update budget spent amount if it's an expense or loan payment and within budget period
    if (transaction.type === "expense" || transaction.type === "loan_payment") {
      const matchingBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
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

  async deleteTransaction(id: number): Promise<void> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    
    if (transaction && (transaction.type === "expense" || transaction.type === "loan_payment")) {
      // Update budget spent amount if within budget period
      const matchingBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
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
    
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  // Budgets
  async getBudgets(): Promise<Budget[]> {
    return await db.select().from(budgets);
  }

  async getBudget(id: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, id));
    return budget || undefined;
  }

  async createBudget(insertBudget: InsertBudget): Promise<Budget> {
    const [budget] = await db
      .insert(budgets)
      .values(insertBudget)
      .returning();
    return budget;
  }

  async updateBudget(id: number, updates: Partial<Budget>): Promise<Budget> {
    const [updated] = await db
      .update(budgets)
      .set(updates)
      .where(eq(budgets.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Budget not found");
    }
    return updated;
  }

  async deleteBudget(id: number): Promise<void> {
    await db.delete(budgets).where(eq(budgets.id, id));
  }

  // Savings Goals
  async getSavingsGoals(): Promise<SavingsGoal[]> {
    return await db.select().from(savingsGoals);
  }

  async getSavingsGoal(id: number): Promise<SavingsGoal | undefined> {
    const [goal] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, id));
    return goal || undefined;
  }

  async createSavingsGoal(insertGoal: InsertSavingsGoal): Promise<SavingsGoal> {
    const [goal] = await db
      .insert(savingsGoals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async updateSavingsGoal(id: number, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const [updated] = await db
      .update(savingsGoals)
      .set(updates)
      .where(eq(savingsGoals.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Savings goal not found");
    }
    return updated;
  }

  async deleteSavingsGoal(id: number): Promise<void> {
    await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
  }

  // Loans
  async getLoans(): Promise<Loan[]> {
    return await db.select().from(loans);
  }

  async getLoan(id: number): Promise<Loan | undefined> {
    const [loan] = await db.select().from(loans).where(eq(loans.id, id));
    return loan || undefined;
  }

  async createLoan(insertLoan: InsertLoan): Promise<Loan> {
    const [loan] = await db
      .insert(loans)
      .values(insertLoan)
      .returning();
    return loan;
  }

  async updateLoan(id: number, updates: Partial<Loan>): Promise<Loan> {
    const [updated] = await db
      .update(loans)
      .set(updates)
      .where(eq(loans.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Loan not found");
    }
    return updated;
  }

  async deleteLoan(id: number): Promise<void> {
    await db.delete(loans).where(eq(loans.id, id));
  }

  // Financial Summary
  async getFinancialSummary(): Promise<{
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
  }> {
    const allTransactions = await this.getTransactions();
    const goals = await this.getSavingsGoals();
    const allLoans = await this.getLoans();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyTransactions = allTransactions.filter((t) => {
      const transactionDate = new Date(t.date);
      return (
        transactionDate.getMonth() === currentMonth &&
        transactionDate.getFullYear() === currentYear
      );
    });

    const monthlyIncome = monthlyTransactions
      .filter((t) => t.type === "income" || t.type === "savings_withdrawal" || t.type === "loan_received")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.type === "expense" || t.type === "savings_deposit" || t.type === "loan_payment")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalSavings = goals.reduce(
      (sum, g) => sum + parseFloat(g.currentAmount),
      0
    );

    const totalDebt = allLoans.reduce((sum, l) => sum + parseFloat(l.balance), 0);

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
