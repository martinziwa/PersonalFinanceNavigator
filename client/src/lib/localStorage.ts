import type { 
  Transaction, 
  InsertTransaction, 
  Budget, 
  InsertBudget, 
  SavingsGoal, 
  InsertSavingsGoal,
  User,
  UpsertUser 
} from "@shared/schema";

// Storage keys for different data types
const STORAGE_KEYS = {
  USER: 'finance_app_user',
  TRANSACTIONS: 'finance_app_transactions',
  BUDGETS: 'finance_app_budgets',
  SAVINGS_GOALS: 'finance_app_savings_goals',
  NEXT_ID: 'finance_app_next_id'
} as const;

// Helper function to get next ID
function getNextId(type: string): number {
  const key = `${STORAGE_KEYS.NEXT_ID}_${type}`;
  const currentId = parseInt(window.localStorage.getItem(key) || '1');
  window.localStorage.setItem(key, (currentId + 1).toString());
  return currentId;
}

// Helper function to safely parse JSON from localStorage
function safeParseJSON<T>(item: string | null, defaultValue: T): T {
  if (!item) return defaultValue;
  try {
    return JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

// Local storage implementation matching the database interface
export class LocalStorageManager {
  // User operations
  getUser(): User | undefined {
    const userData = window.localStorage.getItem(STORAGE_KEYS.USER);
    return safeParseJSON<User | undefined>(userData, undefined);
  }

  upsertUser(userData: UpsertUser): User {
    const existingUser = this.getUser();
    const user: User = {
      id: existingUser?.id || 'local_user',
      email: userData.email || existingUser?.email || null,
      firstName: userData.firstName || existingUser?.firstName || null,
      lastName: userData.lastName || existingUser?.lastName || null,
      profileImageUrl: userData.profileImageUrl || existingUser?.profileImageUrl || null,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    
    window.localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  }

  // Transaction operations
  getTransactions(): Transaction[] {
    const transactions = window.localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return safeParseJSON<Transaction[]>(transactions, []);
  }

  getTransactionsByCategory(category: string): Transaction[] {
    return this.getTransactions().filter(t => t.category === category);
  }

  createTransaction(insertTransaction: InsertTransaction): Transaction {
    const transactions = this.getTransactions();
    const transaction: Transaction = {
      id: getNextId('transaction'),
      userId: 'local_user',
      amount: insertTransaction.amount,
      description: insertTransaction.description,
      category: insertTransaction.category,
      type: insertTransaction.type,
      date: insertTransaction.date ? new Date(insertTransaction.date) : new Date(),
      time: insertTransaction.time || null,
      savingsGoalId: insertTransaction.savingsGoalId || null,
    };

    transactions.push(transaction);
    window.localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    return transaction;
  }

  updateTransaction(id: number, updates: Partial<InsertTransaction>): Transaction {
    const transactions = this.getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    
    if (index === -1) {
      throw new Error('Transaction not found');
    }

    const updatedTransaction = {
      ...transactions[index],
      ...updates,
      date: updates.date ? new Date(updates.date) : transactions[index].date,
    };

    transactions[index] = updatedTransaction;
    window.localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    return updatedTransaction;
  }

  deleteTransaction(id: number): void {
    const transactions = this.getTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    window.localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(filtered));
  }

  // Budget operations
  getBudgets(): Budget[] {
    const budgets = window.localStorage.getItem(STORAGE_KEYS.BUDGETS);
    return safeParseJSON<Budget[]>(budgets, []).map(budget => ({
      ...budget,
      startDate: new Date(budget.startDate),
      endDate: new Date(budget.endDate),
    }));
  }

  getBudget(id: number): Budget | undefined {
    return this.getBudgets().find(b => b.id === id);
  }

  createBudget(insertBudget: InsertBudget): Budget {
    const budgets = this.getBudgets();
    const budget: Budget = {
      id: getNextId('budget'),
      userId: 'local_user',
      category: insertBudget.category,
      amount: insertBudget.amount,
      spent: '0.00',
      period: insertBudget.period || 'monthly',
      startDate: new Date(insertBudget.startDate),
      endDate: new Date(insertBudget.endDate),
      icon: insertBudget.icon || '📝',
      description: insertBudget.description || null,
    };

    budgets.push(budget);
    window.localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
    return budget;
  }

  updateBudget(id: number, updates: Partial<Budget>): Budget {
    const budgets = this.getBudgets();
    const index = budgets.findIndex(b => b.id === id);
    
    if (index === -1) {
      throw new Error('Budget not found');
    }

    const updatedBudget = {
      ...budgets[index],
      ...updates,
      startDate: updates.startDate ? new Date(updates.startDate) : budgets[index].startDate,
      endDate: updates.endDate ? new Date(updates.endDate) : budgets[index].endDate,
    };

    budgets[index] = updatedBudget;
    window.localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
    return updatedBudget;
  }

  deleteBudget(id: number): void {
    const budgets = this.getBudgets();
    const filtered = budgets.filter(b => b.id !== id);
    window.localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(filtered));
  }

  // Savings Goals operations
  getSavingsGoals(): SavingsGoal[] {
    const goals = window.localStorage.getItem(STORAGE_KEYS.SAVINGS_GOALS);
    return safeParseJSON<SavingsGoal[]>(goals, []).map(goal => ({
      ...goal,
      deadline: goal.deadline ? new Date(goal.deadline) : null,
    }));
  }

  getSavingsGoal(id: number): SavingsGoal | undefined {
    return this.getSavingsGoals().find(g => g.id === id);
  }

  createSavingsGoal(insertGoal: InsertSavingsGoal): SavingsGoal {
    const goals = this.getSavingsGoals();
    const goal: SavingsGoal = {
      id: getNextId('savingsGoal'),
      userId: 'local_user',
      name: insertGoal.name,
      targetAmount: insertGoal.targetAmount,
      currentAmount: '0.00',
      startingSavings: insertGoal.startingSavings || '0.00',
      startDate: new Date(),
      deadline: insertGoal.deadline ? new Date(insertGoal.deadline) : null,
      icon: insertGoal.icon || '🎯',
      color: insertGoal.color || '#3B82F6',
    };

    goals.push(goal);
    window.localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(goals));
    return goal;
  }

  updateSavingsGoal(id: number, updates: Partial<SavingsGoal>): SavingsGoal {
    const goals = this.getSavingsGoals();
    const index = goals.findIndex(g => g.id === id);
    
    if (index === -1) {
      throw new Error('Savings goal not found');
    }

    const updatedGoal = {
      ...goals[index],
      ...updates,
      deadline: updates.deadline ? new Date(updates.deadline) : goals[index].deadline,
    };

    goals[index] = updatedGoal;
    localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(goals));
    return updatedGoal;
  }

  deleteSavingsGoal(id: number): void {
    const goals = this.getSavingsGoals();
    const filtered = goals.filter(g => g.id !== id);
    localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(filtered));
  }

  // Financial Summary
  getFinancialSummary(): {
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
  } {
    const allTransactions = this.getTransactions();
    const goals = this.getSavingsGoals();

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
      .filter((t) => t.type === "income" || t.type === "savings_withdrawal")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.type === "expense" || t.type === "savings_deposit")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Calculate total savings from goals
    let totalSavings = 0;
    
    for (const goal of goals) {
      let goalProgress = parseFloat(goal.currentAmount);
      const startingSavings = parseFloat(goal.startingSavings || '0');
      goalProgress += startingSavings;
      
      // Add savings deposits and subtract withdrawals for this goal
      const goalTransactions = allTransactions.filter((t) => t.savingsGoalId === goal.id);
      
      const transactionTotal = goalTransactions.reduce((sum, t) => {
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

    const totalDebt = 0; // No loans in local storage version
    const netWorth = totalSavings;

    return {
      netWorth,
      monthlyIncome,
      monthlyExpenses,
      totalSavings,
      totalDebt,
    };
  }

  // Utility methods for data management
  exportData(): string {
    const data = {
      user: this.getUser(),
      transactions: this.getTransactions(),
      budgets: this.getBudgets(),
      savingsGoals: this.getSavingsGoals(),
      exportDate: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  importData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
      }
      if (data.transactions) {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
      }
      if (data.budgets) {
        localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(data.budgets));
      }
      if (data.savingsGoals) {
        localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(data.savingsGoals));
      }
    } catch (error) {
      throw new Error('Invalid JSON data format');
    }
  }

  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    // Clear ID counters
    ['transaction', 'budget', 'savingsGoal'].forEach(type => {
      localStorage.removeItem(`${STORAGE_KEYS.NEXT_ID}_${type}`);
    });
  }
}

export const localStorage = new LocalStorage();