import { useQuery } from "@tanstack/react-query";
import type { SavingsGoal } from "@shared/schema";

export function useGoals() {
  return useQuery<SavingsGoal[]>({
    queryKey: ["/api/goals"],
  });
}
