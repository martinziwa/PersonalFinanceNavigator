import { useQuery } from "@tanstack/react-query";
import type { Budget } from "@shared/schema";

export function useBudgets() {
  return useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });
}
