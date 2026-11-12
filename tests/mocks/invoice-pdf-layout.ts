import type { InvoicePdfData } from "@/features/billing/pdf-contract";

export const longCombinedInvoice: InvoicePdfData = {
  number: "WK-EXAMPLE",
  date: "2026-11-11",
  period: { from: "2026-11-01", to: "2026-11-11" },
  branch: { name: "Example Branch", address: "123 Example Road" },
  lines: Array.from({ length: 45 }, (_, index) => ({
    name: `Sample Item ${index + 1}`,
    unit: "Box",
    quantity: 2,
    price: 10,
    taxable: false,
    subtotal: 20,
  })),
  subtotal: 900,
  tax: 0,
  total: 900,
  draft: true,
  payment: "UNPAID",
  orders: Array.from({ length: 50 }, (_, index) => ({
    number: index + 1,
    date: "2026-11-02",
    total: 18,
  })),
};
