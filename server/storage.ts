import {
  transactions,
  budgets,
  savingsGoals,
  loans,
  type Transaction,
  type InsertTransaction,
  type Budget,
  type InsertBudget,
  type SavingsGoal,
  type InsertSavingsGoal,
  type Loan,
  type InsertLoan,
} from "@shared/schema";

export interface IStorage {
  // Transactions
  getTransactions(): Promise<Transaction[]>;
  getTransactionsByCategory(category: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;

  // Budgets
  getBudgets(): Promise<Budget[]>;
  getBudget(id: number): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: number, budget: Partial<Budget>): Promise<Budget>;
  deleteBudget(id: number): Promise<void>;

  // Savings Goals
  getSavingsGoals(): Promise<SavingsGoal[]>;
  getSavingsGoal(id: number): Promise<SavingsGoal | undefined>;
  createSavingsGoal(goal: InsertSavingsGoal): Promise<SavingsGoal>;
  updateSavingsGoal(id: number, goal: Partial<SavingsGoal>): Promise<SavingsGoal>;
  deleteSavingsGoal(id: number): Promise<void>;

  // Loans
  getLoans(): Promise<Loan[]>;
  getLoan(id: number): Promise<Loan | undefined>;
  createLoan(loan: InsertLoan): Promise<Loan>;
  updateLoan(id: number, loan: Partial<Loan>): Promise<Loan>;
  deleteLoan(id: number): Promise<void>;

  // Financial Summary
  getFinancialSummary(): Promise<{
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
  }>;
}

export class MemStorage implements IStorage {
  private transactions: Map<number, Transaction>;
  private budgets: Map<number, Budget>;
  private savingsGoals: Map<number, SavingsGoal>;
  private loans: Map<number, Loan>;
  private currentId: { [key: string]: number };

  constructor() {
    this.transactions = new Map();
    this.budgets = new Map();
    this.savingsGoals = new Map();
    this.loans = new Map();
    this.currentId = {
      transactions: 1,
      budgets: 1,
      savingsGoals: 1,
      loans: 1,
    };
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getTransactionsByCategory(category: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(
      (t) => t.category === category
    );
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentId.transactions++;
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      date: new Date(),
    };
    this.transactions.set(id, transaction);

    // Update budget spent amount if it's an expense and within budget period
    if (transaction.type === "expense") {
      const budget = Array.from(this.budgets.values()).find(
        (b) => b.category === transaction.category &&
        new Date(b.startDate) <= transaction.date &&
        new Date(b.endDate) >= transaction.date
      );
      if (budget) {
        const newSpent = parseFloat(budget.spent) + parseFloat(transaction.amount);
        budget.spent = newSpent.toString();
        this.budgets.set(budget.id, budget);
      }
    }

    return transaction;
  }

  async deleteTransaction(id: number): Promise<void> {
    const transaction = this.transactions.get(id);
    if (transaction && transaction.type === "expense") {
      // Update budget spent amount if within budget period
      const budget = Array.from(this.budgets.values()).find(
        (b) => b.category === transaction.category &&
        new Date(b.startDate) <= new Date(transaction.date) &&
        new Date(b.endDate) >= new Date(transaction.date)
      );
      if (budget) {
        const newSpent = parseFloat(budget.spent) - parseFloat(transaction.amount);
        budget.spent = Math.max(0, newSpent).toString();
        this.budgets.set(budget.id, budget);
      }
    }
    this.transactions.delete(id);
  }

  // Budgets
  async getBudgets(): Promise<Budget[]> {
    return Array.from(this.budgets.values());
  }

  async getBudget(id: number): Promise<Budget | undefined> {
    return this.budgets.get(id);
  }

  async createBudget(insertBudget: InsertBudget): Promise<Budget> {
    const id = this.currentId.budgets++;
    const budget: Budget = {
      ...insertBudget,
      id,
      spent: "0",
      period: insertBudget.period || "monthly",
    };
    this.budgets.set(id, budget);
    return budget;
  }

  async updateBudget(id: number, updates: Partial<Budget>): Promise<Budget> {
    const budget = this.budgets.get(id);
    if (!budget) {
      throw new Error("Budget not found");
    }
    const updated = { ...budget, ...updates };
    this.budgets.set(id, updated);
    return updated;
  }

  async deleteBudget(id: number): Promise<void> {
    this.budgets.delete(id);
  }

  // Savings Goals
  async getSavingsGoals(): Promise<SavingsGoal[]> {
    return Array.from(this.savingsGoals.values());
  }

  async getSavingsGoal(id: number): Promise<SavingsGoal | undefined> {
    return this.savingsGoals.get(id);
  }

  async createSavingsGoal(insertGoal: InsertSavingsGoal): Promise<SavingsGoal> {
    const id = this.currentId.savingsGoals++;
    const goal: SavingsGoal = {
      ...insertGoal,
      id,
      currentAmount: "0",
      deadline: insertGoal.deadline || null,
    };
    this.savingsGoals.set(id, goal);
    return goal;
  }

  async updateSavingsGoal(id: number, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const goal = this.savingsGoals.get(id);
    if (!goal) {
      throw new Error("Savings goal not found");
    }
    const updated = { ...goal, ...updates };
    this.savingsGoals.set(id, updated);
    return updated;
  }

  async deleteSavingsGoal(id: number): Promise<void> {
    this.savingsGoals.delete(id);
  }

  // Loans
  async getLoans(): Promise<Loan[]> {
    return Array.from(this.loans.values());
  }

  async getLoan(id: number): Promise<Loan | undefined> {
    return this.loans.get(id);
  }

  async createLoan(insertLoan: InsertLoan): Promise<Loan> {
    const id = this.currentId.loans++;
    const loan: Loan = {
      ...insertLoan,
      id,
    };
    this.loans.set(id, loan);
    return loan;
  }

  async updateLoan(id: number, updates: Partial<Loan>): Promise<Loan> {
    const loan = this.loans.get(id);
    if (!loan) {
      throw new Error("Loan not found");
    }
    const updated = { ...loan, ...updates };
    this.loans.set(id, updated);
    return updated;
  }

  async deleteLoan(id: number): Promise<void> {
    this.loans.delete(id);
  }

  // Financial Summary
  async getFinancialSummary(): Promise<{
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
  }> {
    const transactions = await this.getTransactions();
    const goals = await this.getSavingsGoals();
    const loans = await this.getLoans();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyTransactions = transactions.filter((t) => {
      const transactionDate = new Date(t.date);
      return (
        transactionDate.getMonth() === currentMonth &&
        transactionDate.getFullYear() === currentYear
      );
    });

    const monthlyIncome = monthlyTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalSavings = goals.reduce(
      (sum, g) => sum + parseFloat(g.currentAmount),
      0
    );

    const totalDebt = loans.reduce((sum, l) => sum + parseFloat(l.balance), 0);

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

export const storage = new MemStorage();
