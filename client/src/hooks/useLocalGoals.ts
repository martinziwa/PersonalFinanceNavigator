import { useQuery, useMutation } from "@tanstack/react-query";
import { localQueries, localMutations, localQueryClient } from "@/lib/localQueryClient";
import type { InsertSavingsGoal, SavingsGoal } from "@shared/schema";

export function useLocalGoals() {
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['local-goals'],
    queryFn: localQueries.getSavingsGoals,
  });

  const createMutation = useMutation({
    mutationFn: localMutations.createSavingsGoal,
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-goals'] });
      localQueryClient.invalidateQueries({ queryKey: ['local-financial-summary'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SavingsGoal> }) =>
      localMutations.updateSavingsGoal(id, data),
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-goals'] });
      localQueryClient.invalidateQueries({ queryKey: ['local-financial-summary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: localMutations.deleteSavingsGoal,
    onSuccess: () => {
      localQueryClient.invalidateQueries({ queryKey: ['local-goals'] });
      localQueryClient.invalidateQueries({ queryKey: ['local-financial-summary'] });
    },
  });

  return {
    goals,
    isLoading,
    createGoal: createMutation.mutate,
    updateGoal: updateMutation.mutate,
    deleteGoal: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}