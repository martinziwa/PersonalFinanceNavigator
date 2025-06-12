import { QueryClient } from "@tanstack/react-query";
import { localStorage } from "./localStorage";
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

// Local query functions that simulate API calls but use localStorage
export const localQueries = {
  // User queries
  getUser: () => localStorage.getUser(),
  
  // Transaction queries
  getTransactions: () => localStorage.getTransactions(),
  getTransactionsByCategory: (category: string) => localStorage.getTransactionsByCategory(category),
  createTransaction: (data: InsertTransaction) => localStorage.createTransaction(data),
  updateTransaction: (id: number, data: Partial<InsertTransaction>) => localStorage.updateTransaction(id, data),
  deleteTransaction: (id: number) => localStorage.deleteTransaction(id),
  
  // Budget queries
  getBudgets: () => localStorage.getBudgets(),
  getBudget: (id: number) => localStorage.getBudget(id),
  createBudget: (data: InsertBudget) => localStorage.createBudget(data),
  updateBudget: (id: number, data: Partial<Budget>) => localStorage.updateBudget(id, data),
  deleteBudget: (id: number) => localStorage.deleteBudget(id),
  
  // Savings Goals queries
  getSavingsGoals: () => localStorage.getSavingsGoals(),
  getSavingsGoal: (id: number) => localStorage.getSavingsGoal(id),
  createSavingsGoal: (data: InsertSavingsGoal) => localStorage.createSavingsGoal(data),
  updateSavingsGoal: (id: number, data: Partial<SavingsGoal>) => localStorage.updateSavingsGoal(id, data),
  deleteSavingsGoal: (id: number) => localStorage.deleteSavingsGoal(id),
  
  // Financial summary
  getFinancialSummary: () => localStorage.getFinancialSummary(),
};

// Helper function to invalidate queries after mutations
export const invalidateLocalQueries = (queryKeys: string[]) => {
  queryKeys.forEach(key => {
    localQueryClient.invalidateQueries({ queryKey: [key] });
  });
};

// Mutation helpers for common operations
export const localMutations = {
  createTransaction: (data: InsertTransaction) => {
    const result = localQueries.createTransaction(data);
    invalidateLocalQueries(['/api/transactions', '/api/financial-summary']);
    return result;
  },
  
  updateTransaction: (id: number, data: Partial<InsertTransaction>) => {
    const result = localQueries.updateTransaction(id, data);
    invalidateLocalQueries(['/api/transactions', '/api/financial-summary']);
    return result;
  },
  
  deleteTransaction: (id: number) => {
    localQueries.deleteTransaction(id);
    invalidateLocalQueries(['/api/transactions', '/api/financial-summary']);
  },
  
  createBudget: (data: InsertBudget) => {
    const result = localQueries.createBudget(data);
    invalidateLocalQueries(['/api/budgets']);
    return result;
  },
  
  updateBudget: (id: number, data: Partial<Budget>) => {
    const result = localQueries.updateBudget(id, data);
    invalidateLocalQueries(['/api/budgets']);
    return result;
  },
  
  deleteBudget: (id: number) => {
    localQueries.deleteBudget(id);
    invalidateLocalQueries(['/api/budgets']);
  },
  
  createSavingsGoal: (data: InsertSavingsGoal) => {
    const result = localQueries.createSavingsGoal(data);
    invalidateLocalQueries(['/api/goals', '/api/financial-summary']);
    return result;
  },
  
  updateSavingsGoal: (id: number, data: Partial<SavingsGoal>) => {
    const result = localQueries.updateSavingsGoal(id, data);
    invalidateLocalQueries(['/api/goals', '/api/financial-summary']);
    return result;
  },
  
  deleteSavingsGoal: (id: number) => {
    localQueries.deleteSavingsGoal(id);
    invalidateLocalQueries(['/api/goals', '/api/financial-summary']);
  },
};