"use client";

import { ReactNode, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { supabase } from "@/lib/supabase/client";
import type { Location } from "@/lib/supabase/types";

export function LocationDialog({
  location,
  trigger,
  onSaved,
  open,
  onOpenChange,
}: {
  location?: Location;
  trigger?: ReactNode;
  onSaved?: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const mode = location ? "edit" : "create";
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("ON");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isCentral, setIsCentral] = useState(false);

  useEffect(() => {
    if (location) {
      setName(location.name);
      setCity(location.city ?? "");
      setProvince(location.province ?? "ON");
      setAddress(location.address ?? "");
      setPhone(location.phone ?? "");
      setIsCentral(location.is_central);
    } else {
      setName("");
      setCity("");
      setProvince("ON");
      setAddress("");
      setPhone("");
      setIsCentral(false);
    }
  }, [location]);

  async function handleSubmit() {
    const payload = {
      name: name.trim(),
      city: city.trim() || null,
      province: province.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      is_central: isCentral,
    };
    const { error } =
      mode === "edit"
        ? await supabase.from("locations").update(payload).eq("id", location!.id)
        : await supabase.from("locations").insert(payload);
    if (error) throw new Error(error.message);
    onSaved?.();
  }

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button size="lg">
            <Plus className="size-4" /> Add Branch
          </Button>
        )
      }
      title={mode === "edit" ? "Edit Branch" : "Add Branch"}
      submitLabel={mode === "edit" ? "Save Changes" : "Add Branch"}
      onSubmit={handleSubmit}
      open={open}
      onOpenChange={onOpenChange}
    >
      <FormField label="Branch Name" htmlFor="loc-name" required>
        <Input
          id="loc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Aaha Oshawa"
          required
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="City" htmlFor="loc-city">
          <Input
            id="loc-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Oshawa"
          />
        </FormField>
        <FormField label="Province" htmlFor="loc-prov">
          <Input
            id="loc-prov"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="ON"
          />
        </FormField>
      </div>

      <FormField label="Address" htmlFor="loc-addr">
        <Input
          id="loc-addr"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St"
        />
      </FormField>

      <FormField label="Phone" htmlFor="loc-phone">
        <Input
          id="loc-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm pt-1">
        <input
          type="checkbox"
          checked={isCentral}
          onChange={(e) => setIsCentral(e.target.checked)}
          className="size-4 accent-saffron"
        />
        This is the Central Kitchen
      </label>
    </FormDialog>
  );
}
