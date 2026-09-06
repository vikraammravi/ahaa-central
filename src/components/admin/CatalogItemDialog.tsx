"use client";

import { ReactNode, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem, UnitMeasurement } from "@/lib/supabase/types";

const CATEGORIES = ["Batter", "Curry", "Chutney", "Sweet", "Pantry"];
const UNITS: UnitMeasurement[] = ["Bucket", "Tray", "Piece", "Can"];

type Mode = "create" | "edit";

// Reusable — pass no `item` to create; pass one to edit.
// Optional `trigger` overrides the default "Add Item" button.
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
  const mode: Mode = item ? "edit" : "create";

  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [unit, setUnit] = useState<UnitMeasurement>(UNITS[0]);
  const [price, setPrice] = useState("");
  const [isTaxable, setIsTaxable] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setUnit(item.unit_type);
      setPrice(String(item.default_price));
      setIsTaxable(item.is_taxable);
      setIsActive(item.is_active);
    } else {
      setName("");
      setCategory(CATEGORIES[0]);
      setUnit(UNITS[0]);
      setPrice("");
      setIsTaxable(true);
      setIsActive(true);
    }
  }, [item]);

  async function handleSubmit() {
    const payload = {
      name: name.trim(),
      category,
      unit_type: unit,
      default_price: Number(price) || 0,
      is_taxable: isTaxable,
      is_active: isActive,
    };
    const { error } =
      mode === "edit"
        ? await supabase.from("catalog_items").update(payload).eq("id", item!.id)
        : await supabase.from("catalog_items").insert({ ...payload, available_stock: 0 });
    if (error) throw new Error(error.message);
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
          <select
            id="ci-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Unit" htmlFor="ci-unit">
          <select
            id="ci-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as UnitMeasurement)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
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

      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isTaxable}
            onChange={(e) => setIsTaxable(e.target.checked)}
            className="size-4 accent-saffron"
          />
          Taxable (HST 13%)
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
