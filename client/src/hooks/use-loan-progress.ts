import { useQuery } from "@tanstack/react-query";

interface LoanProgress {
  principalProgress: number | null;
  interestProgress: number | null;
  totalPaid: number;
  principalPaid: number;
  interestPaid: number;
}

export function useLoanProgress(loanId: number | null) {
  return useQuery<LoanProgress>({
    queryKey: ["/api/loans", loanId, "progress"],
    enabled: !!loanId,
  });
}