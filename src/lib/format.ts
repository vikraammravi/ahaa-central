export const BUSINESS_TIME_ZONE = "America/Toronto";
export const TAX_RATE = 0.13;
export const DEFAULT_STOCK_THRESHOLD = 20;
export const POLL_INTERVAL = 5000;

export function formatMoney(amount: number | string | null | undefined): string {
  return `CA$${Number(amount ?? 0).toFixed(2)}`;
}
export function taxLabel(taxable: boolean): string { return taxable ? "13%" : "N/A"; }
function dateForDisplay(value: string | Date): Date {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}
export function formatDate(value: string | Date): string {
  const date = dateForDisplay(value);
  return date.toLocaleDateString("en-US", { timeZone: BUSINESS_TIME_ZONE, month: "short", day: "numeric", year: "numeric" });
}
export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function formatTime(value: string | Date): string {
  return dateForDisplay(value).toLocaleTimeString("en-US", { timeZone: BUSINESS_TIME_ZONE, hour: "numeric", minute: "2-digit", hour12: true });
}
