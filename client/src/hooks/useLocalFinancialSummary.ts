import { useQuery } from "@tanstack/react-query";
import { localQueries } from "@/lib/localQueryClient";

export function useLocalFinancialSummary() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['local-financial-summary'],
    queryFn: localQueries.getFinancialSummary,
  });

  return {
    summary: summary || {
      netWorth: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      totalSavings: 0,
      totalDebt: 0,
    },
    isLoading,
  };
}