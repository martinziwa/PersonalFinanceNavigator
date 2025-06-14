import { useQuery } from "@tanstack/react-query";
import type { Loan } from "@shared/schema";

export function useLoans() {
  return useQuery<Loan[]>({
    queryKey: ["/api/loans"],
  });
}