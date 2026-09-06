"use client";

import { useEffect, useState } from "react";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
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

  const branchOptions = [
    { value: "", label: "—" },
    ...locations
      .filter((l) => !l.is_central)
      .map((l) => ({ value: l.id, label: l.name })),
  ];

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
          <FormSelect<UserRole>
            id="p-role"
            value={role}
            onChange={setRole}
            options={[
              { value: "CENTRAL_ADMIN", label: "Central Admin" },
              { value: "BRANCH_MANAGER", label: "Branch Manager" },
            ]}
          />
        </FormField>
        <FormField label="Status" htmlFor="p-status">
          <FormSelect<ProfileStatus>
            id="p-status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Active" },
              { value: "pending", label: "Pending" },
              { value: "disabled", label: "Disabled" },
            ]}
          />
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
        <FormSelect
          id="p-loc"
          value={locationId}
          onChange={setLocationId}
          options={branchOptions}
          disabled={role === "CENTRAL_ADMIN"}
          className="disabled:opacity-50"
        />
      </FormField>
    </FormDialog>
  );
}
