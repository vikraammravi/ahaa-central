import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileEditDialog } from "@/components/admin/ProfileEditDialog";
import { branch, profile } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("profile editing updates assigned role without creating another login",async()=>{
  const query=queryResult(null);db.from.mockReturnValue(query);render(<ProfileEditDialog profile={profile} locations={[branch]} open onOpenChange={vi.fn()} onSaved={vi.fn()}/>);await userEvent.selectOptions(screen.getByLabelText("Role"),"BRANCH_EMPLOYEE");await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));expect(query.update).toHaveBeenCalledWith(expect.objectContaining({role:"BRANCH_EMPLOYEE",location_id:branch.id}));expect(fetch).not.toHaveBeenCalled();
});
