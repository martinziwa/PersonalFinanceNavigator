import { useQuery, useMutation } from "@tanstack/react-query";
import { localQueries, localMutations, localQueryClient } from "@/lib/localQueryClient";
import type { InsertTransaction } from "@shared/schema";

export function useLocalTransactions() {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['local-transactions'],
    queryFn: localQueries.getTransactions,
  });

  const createMutation = useMutation({
    mutationFn: localMutations.createTransaction,
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-transactions'] });
      localQueryClient.invalidateQueries({ queryKey: ['local-financial-summary'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertTransaction> }) =>
      localMutations.updateTransaction(id, data),
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-transactions'] });
      localQueryClient.invalidateQueries({ queryKey: ['local-financial-summary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: localMutations.deleteTransaction,
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-transactions'] });
      localQueryClient.invalidateQueries({ queryKey: ['local-financial-summary'] });
    },
  });

  return {
    transactions,
    isLoading,
    createTransaction: createMutation.mutate,
    updateTransaction: updateMutation.mutate,
    deleteTransaction: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}