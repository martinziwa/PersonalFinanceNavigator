import { QueryClient } from "@tanstack/react-query";
import { localStorageManager } from "./localStorage";
import type { 
  Transaction, 
  InsertTransaction, 
  Budget, 
  InsertBudget, 
  SavingsGoal, 
  InsertSavingsGoal 
} from "@shared/schema";

// Create a query client for local storage operations
export const localQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
    },
  },
});

// Local query functions that simulate API calls but use localStorageManager
export const localQueries = {
  // User queries
  getUser: () => localStorageManager.getUser(),
  
  // Transaction queries
  getTransactions: () => localStorageManager.getTransactions(),
  getTransactionsByCategory: (category: string) => localStorageManager.getTransactionsByCategory(category),
  createTransaction: (data: InsertTransaction) => localStorageManager.createTransaction(data),
  updateTransaction: (id: number, data: Partial<InsertTransaction>) => localStorageManager.updateTransaction(id, data),
  deleteTransaction: (id: number) => localStorageManager.deleteTransaction(id),
  
  // Budget queries
  getBudgets: () => localStorageManager.getBudgets(),
  getBudget: (id: number) => localStorageManager.getBudget(id),
  createBudget: (data: InsertBudget) => localStorageManager.createBudget(data),
  updateBudget: (id: number, data: Partial<Budget>) => localStorageManager.updateBudget(id, data),
  deleteBudget: (id: number) => localStorageManager.deleteBudget(id),
  
  // Savings Goals queries
  getSavingsGoals: () => localStorageManager.getSavingsGoals(),
  getSavingsGoal: (id: number) => localStorageManager.getSavingsGoal(id),
  createSavingsGoal: (data: InsertSavingsGoal) => localStorageManager.createSavingsGoal(data),
  updateSavingsGoal: (id: number, data: Partial<SavingsGoal>) => localStorageManager.updateSavingsGoal(id, data),
  deleteSavingsGoal: (id: number) => localStorageManager.deleteSavingsGoal(id),
  
  // Financial summary
  getFinancialSummary: () => localStorageManager.getFinancialSummary(),
};

// Helper function to invalidate queries after mutations
export const invalidateLocalQueries = (queryKeys: string[]) => {
  queryKeys.forEach(key => {
    localQueryClient.invalidateQueries({ queryKey: [key] });
  });
};

// Mutation helpers for common operations
export const localMutations = {
  createTransaction: async (data: InsertTransaction) => {
    const result = localQueries.createTransaction(data);
    invalidateLocalQueries(['local-transactions', 'local-financial-summary']);
    return result;
  },
  
  updateTransaction: async (id: number, data: Partial<InsertTransaction>) => {
    const result = localQueries.updateTransaction(id, data);
    invalidateLocalQueries(['local-transactions', 'local-financial-summary']);
    return result;
  },
  
  deleteTransaction: async (id: number) => {
    localQueries.deleteTransaction(id);
    invalidateLocalQueries(['local-transactions', 'local-financial-summary']);
    return;
  },
  
  createBudget: async (data: InsertBudget) => {
    const result = localQueries.createBudget(data);
    invalidateLocalQueries(['local-budgets']);
    return result;
  },
  
  updateBudget: async (id: number, data: Partial<Budget>) => {
    const result = localQueries.updateBudget(id, data);
    invalidateLocalQueries(['local-budgets']);
    return result;
  },
  
  deleteBudget: async (id: number) => {
    localQueries.deleteBudget(id);
    invalidateLocalQueries(['local-budgets']);
    return;
  },
  
  createSavingsGoal: async (data: InsertSavingsGoal) => {
    const result = localQueries.createSavingsGoal(data);
    invalidateLocalQueries(['local-goals', 'local-financial-summary']);
    return result;
  },
  
  updateSavingsGoal: async (id: number, data: Partial<SavingsGoal>) => {
    const result = localQueries.updateSavingsGoal(id, data);
    invalidateLocalQueries(['local-goals', 'local-financial-summary']);
    return result;
  },
  
  deleteSavingsGoal: async (id: number) => {
    localQueries.deleteSavingsGoal(id);
    invalidateLocalQueries(['local-goals', 'local-financial-summary']);
    return;
  },
};