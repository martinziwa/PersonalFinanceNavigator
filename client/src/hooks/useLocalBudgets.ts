import { useQuery, useMutation } from "@tanstack/react-query";
import { localQueries, localMutations, localQueryClient } from "@/lib/localQueryClient";
import type { InsertBudget, Budget } from "@shared/schema";

export function useLocalBudgets() {
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['local-budgets'],
    queryFn: localQueries.getBudgets,
  });

  const createMutation = useMutation({
    mutationFn: localMutations.createBudget,
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-budgets'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Budget> }) =>
      localMutations.updateBudget(id, data),
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-budgets'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: localMutations.deleteBudget,
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-budgets'] });
    },
  });

  return {
    budgets,
    isLoading,
    createBudget: createMutation.mutate,
    updateBudget: updateMutation.mutate,
    deleteBudget: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}