export const BUSINESS_TIME_ZONE = "America/Toronto";
export const TAX_RATE = 0.13;
export const DEFAULT_STOCK_THRESHOLD = 20;
export const POLL_INTERVAL = 5000;

export function formatMoney(amount: number | string | null | undefined): string {
  return `CA$${Number(amount ?? 0).toFixed(2)}`;
}
export function taxLabel(taxable: boolean): string { return taxable ? "13%" : "-"; }
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return date.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE });
}
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-CA", { timeZone: BUSINESS_TIME_ZONE });
}
