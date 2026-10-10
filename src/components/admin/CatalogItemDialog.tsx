"use client";

import { ReactNode, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem, UnitMeasurement } from "@/lib/supabase/types";
import { DEFAULT_STOCK_THRESHOLD, taxLabel } from "@/lib/format";

const CATEGORIES = ["Batter", "Curry", "Chutney", "Sweet", "Pantry"] as const;
const UNITS: readonly UnitMeasurement[] = ["Bucket", "Tray", "Piece", "Can", "Box", "Bottle", "Bag"];

export function CatalogItemDialog({
  item,
  trigger,
  onSaved,
  open,
  onOpenChange,
}: {
  item?: CatalogItem;
  trigger?: ReactNode;
  onSaved?: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const mode = item ? "edit" : "create";

  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<string>(item?.category ?? CATEGORIES[0]);
  const [unit, setUnit] = useState<UnitMeasurement>(item?.unit_type ?? UNITS[0]);
  const [price, setPrice] = useState(item ? String(item.default_price) : "");
  const [threshold, setThreshold] = useState(String(item?.low_stock_threshold ?? DEFAULT_STOCK_THRESHOLD));
  const [isTaxable, setIsTaxable] = useState(item?.is_taxable ?? true);
  const [isActive, setIsActive] = useState(item?.is_active ?? true);

  async function handleSubmit() {
    if (!name.trim()) throw new Error("Enter an item name.");
    if (!Number.isFinite(Number(price)) || Number(price) < 0) throw new Error("Enter a valid nonnegative price.");
    const lowStockThreshold = Number(threshold);
    if (threshold.trim() === "" || !Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 2147483647) {
      throw new Error("Threshold must be a whole number of zero or more.");
    }
    const payload = {
      name: name.trim(),
      category,
      unit_type: unit,
      default_price: Number(price) || 0,
      low_stock_threshold: lowStockThreshold,
      is_taxable: isTaxable,
      is_active: isActive,
    };
    const { error } =
      mode === "edit"
        ? await supabase.from("catalog_items").update(payload).eq("id", item!.id)
        : await supabase
            .from("catalog_items")
            .insert({ ...payload, available_stock: 0 });
    if (error) throw new Error(error.message);
    if (!item) {
      setName(""); setCategory(CATEGORIES[0]); setUnit(UNITS[0]); setPrice("");
      setThreshold(String(DEFAULT_STOCK_THRESHOLD)); setIsTaxable(true); setIsActive(true);
    }
    onSaved?.();
  }

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button size="lg">
            <Plus className="size-4" /> Add Item
          </Button>
        )
      }
      title={mode === "edit" ? "Edit Catalog Item" : "Add Catalog Item"}
      description={
        mode === "edit"
          ? "Update this product's details."
          : "This item becomes available for stock updates and branch orders."
      }
      submitLabel={mode === "edit" ? "Save Changes" : "Add Item"}
      onSubmit={handleSubmit}
      open={open}
      onOpenChange={onOpenChange}
    >
      <FormField label="Item Name" htmlFor="ci-name" required>
        <Input
          id="ci-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mint Chutney"
          required
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Category" htmlFor="ci-cat">
          <FormSelect
            id="ci-cat"
            value={category}
            onChange={setCategory}
            options={CATEGORIES}
          />
        </FormField>
        <FormField label="Unit" htmlFor="ci-unit">
          <FormSelect<UnitMeasurement>
            id="ci-unit"
            value={unit}
            onChange={setUnit}
            options={UNITS}
          />
        </FormField>
      </div>

      <FormField label="Base Price (CA$)" htmlFor="ci-price" required>
        <Input
          id="ci-price"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Low Stock Threshold" htmlFor="ci-threshold" required hint="Stock below this quantity is marked as low. Use 0 to disable low-stock alerts.">
        <Input id="ci-threshold" type="number" min="0" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} required />
      </FormField>

      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isTaxable}
            onChange={(e) => setIsTaxable(e.target.checked)}
            className="size-4 accent-saffron"
          />
          Tax: {taxLabel(isTaxable)}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 accent-saffron"
          />
          Active
        </label>
      </div>
    </FormDialog>
  );
}
