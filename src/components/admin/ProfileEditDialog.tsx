"use client";

import { useEffect, useState } from "react";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import type {
  Location,
  Profile,
  ProfileStatus,
  UserRole,
} from "@/lib/supabase/types";

export function ProfileEditDialog({
  profile,
  locations,
  open,
  onOpenChange,
  onSaved,
}: {
  profile: Profile;
  locations: Location[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("BRANCH_MANAGER");
  const [status, setStatus] = useState<ProfileStatus>("pending");
  const [locationId, setLocationId] = useState<string>("");

  useEffect(() => {
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setRole(profile.role);
    setStatus(profile.status);
    setLocationId(profile.location_id ?? "");
  }, [profile]);

  async function handleSubmit() {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role,
        status,
        location_id: locationId || null,
      })
      .eq("id", profile.id);
    if (error) throw new Error(error.message);
    onSaved();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit User"
      description={profile.email}
      submitLabel="Save Changes"
      onSubmit={handleSubmit}
    >
      <FormField label="Full Name" htmlFor="p-name" required>
        <Input
          id="p-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Phone" htmlFor="p-phone">
        <Input
          id="p-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Role" htmlFor="p-role">
          <select
            id="p-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="CENTRAL_ADMIN">Central Admin</option>
            <option value="BRANCH_MANAGER">Branch Manager</option>
          </select>
        </FormField>
        <FormField label="Status" htmlFor="p-status">
          <select
            id="p-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProfileStatus)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="disabled">Disabled</option>
          </select>
        </FormField>
      </div>

      <FormField
        label="Branch"
        htmlFor="p-loc"
        hint={
          role === "CENTRAL_ADMIN"
            ? "Central admins don't need a branch."
            : "Assign the branch this manager will operate."
        }
      >
        <select
          id="p-loc"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={role === "CENTRAL_ADMIN"}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50"
        >
          <option value="">—</option>
          {locations
            .filter((l) => !l.is_central)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </FormField>
    </FormDialog>
  );
}
