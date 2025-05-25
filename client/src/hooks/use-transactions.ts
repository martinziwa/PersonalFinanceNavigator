import { useQuery } from "@tanstack/react-query";
import type { Transaction } from "@shared/schema";

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });
}
