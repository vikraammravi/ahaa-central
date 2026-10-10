import type { OrderLine } from "./supabase/types";

export function pickupHasChanges(
  lines: Pick<OrderLine, "id" | "fulfilled_quantity">[],
  quantities: Record<string, number>,
) {
  return lines.some((line) => (quantities[line.id] ?? line.fulfilled_quantity) !== line.fulfilled_quantity);
}

export function pickupQuantitiesValid(
  lines: Pick<OrderLine, "id" | "quantity" | "fulfilled_quantity">[],
  quantities: Record<string, number>,
) {
  return lines.length > 0 && lines.every((line) => {
    const quantity = quantities[line.id] ?? line.fulfilled_quantity;
    return Number.isInteger(quantity) && quantity >= 0 && quantity <= line.quantity;
  });
}
