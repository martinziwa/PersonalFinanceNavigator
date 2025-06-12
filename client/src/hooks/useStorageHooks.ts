import { useStorageContext } from '@/providers/StorageProvider';
import { useTransactions } from './use-transactions';
import { useBudgets } from './use-budgets';
import { useGoals } from './use-goals';
import { useLocalTransactions } from './useLocalTransactions';
import { useLocalBudgets } from './useLocalBudgets';
import { useLocalGoals } from './useLocalGoals';
import { useLocalFinancialSummary } from './useLocalFinancialSummary';
import { useQuery } from '@tanstack/react-query';

export function useAdaptiveTransactions() {
  const { isLocalMode } = useStorageContext();
  const databaseTransactions = useTransactions();
  const localTransactions = useLocalTransactions();
  
  return isLocalMode ? {
    data: localTransactions.transactions,
    isLoading: localTransactions.isLoading
  } : databaseTransactions;
}

export function useAdaptiveBudgets() {
  const { isLocalMode } = useStorageContext();
  const databaseBudgets = useBudgets();
  const localBudgets = useLocalBudgets();
  
  return isLocalMode ? {
    data: localBudgets.budgets,
    isLoading: localBudgets.isLoading
  } : databaseBudgets;
}

export function useAdaptiveGoals() {
  const { isLocalMode } = useStorageContext();
  const databaseGoals = useGoals();
  const localGoals = useLocalGoals();
  
  return isLocalMode ? {
    data: localGoals.goals,
    isLoading: localGoals.isLoading
  } : databaseGoals;
}

export function useAdaptiveFinancialSummary() {
  const { isLocalMode } = useStorageContext();
  const localSummary = useLocalFinancialSummary();
  const databaseSummary = useQuery({
    queryKey: ["/api/financial-summary"],
  });
  
  return isLocalMode ? {
    data: localSummary.summary,
    isLoading: localSummary.isLoading
  } : databaseSummary;
}