import { useQuery } from "@tanstack/react-query";

export function useLoanProgress(loanId: number | null) {
  return useQuery({
    queryKey: ["/api/loans", loanId, "progress"],
    enabled: !!loanId,
  });
}