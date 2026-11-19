import type { ReceiptItem } from "./domain";

type Cell = { rowIndex?: number; columnIndex?: number; content?: string; rowSpan?: number; columnSpan?: number };
export type InvoiceTable = { rowCount?: number; columnCount?: number; cells?: Cell[] };

/** Only recover complete, unambiguous rows that agree with the invoice subtotal. */
export function recoverInvoiceTableItems(tables: InvoiceTable[] | undefined, subtotal: number | null): ReceiptItem[] | null {
  if (!tables || subtotal === null || !Number.isFinite(subtotal)) return null;
  const matches: ReceiptItem[][] = [];
  for (const table of tables) {
    const { rowCount, columnCount, cells } = table;
    if (!rowCount || rowCount < 3 || rowCount > 301 || !columnCount || columnCount > 30 || !Array.isArray(cells)) continue;
    if (cells.some(cell => (cell.rowSpan ?? 1) !== 1 || (cell.columnSpan ?? 1) !== 1)) continue;
    const grid = new Map<string, string>();
    let malformed = false;
    for (const cell of cells) {
      if (!Number.isInteger(cell.rowIndex) || !Number.isInteger(cell.columnIndex) || cell.rowIndex! < 0 || cell.rowIndex! >= rowCount || cell.columnIndex! < 0 || cell.columnIndex! >= columnCount) { malformed = true; break; }
      const key = `${cell.rowIndex}:${cell.columnIndex}`;
      if (grid.has(key)) { malformed = true; break; }
      grid.set(key, (cell.content ?? "").trim());
    }
    if (malformed) continue;
    const headers = Array.from({ length: columnCount }, (_, col) => (grid.get(`0:${col}`) ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
    const select = (options: string[]) => { const found = headers.flatMap((value, index) => options.includes(value) ? [index] : []); return found.length === 1 ? found[0] : -1; };
    const description = select(["product name", "item", "item name", "description"]);
    const quantity = select(["qty", "quantity"]);
    const unitPrice = select(["rate", "unit price", "price"]);
    const amount = select(["amount", "line total", "total price"]);
    if ([description, quantity, unitPrice, amount].some(col => col < 0)) continue;
    const readNumber = (value: string): number | null => {
      const clean = value.trim().replace(/^\$\s*/, "");
      if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,4})?$/.test(clean)) return null;
      const parsed = Number(clean.replace(/,/g, ""));
      return Number.isFinite(parsed) && parsed <= 10_000_000 ? parsed : null;
    };
    const rows: ReceiptItem[] = [];
    for (let row = 1; row < rowCount; row++) {
      const name = grid.get(`${row}:${description}`) ?? "";
      const qty = readNumber(grid.get(`${row}:${quantity}`) ?? "");
      const price = readNumber(grid.get(`${row}:${unitPrice}`) ?? "");
      const total = readNumber(grid.get(`${row}:${amount}`) ?? "");
      if (!name || name.length > 1000 || qty === null || qty <= 0 || price === null || total === null || Math.abs(qty * price - total) > 0.02) { malformed = true; break; }
      rows.push({ description: name, quantity: qty, unitPrice: price, amount: total });
    }
    if (!malformed && rows.length >= 2 && Math.abs(rows.reduce((sum, row) => sum + row.amount!, 0) - subtotal) <= 0.02) matches.push(rows);
  }
  return matches.length === 1 ? matches[0] : null;
}
