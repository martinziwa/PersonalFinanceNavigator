export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-MW", {
    style: "currency",
    currency: "MWK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}