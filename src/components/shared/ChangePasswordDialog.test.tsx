import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChangePasswordDialog } from "@/components/shared/ChangePasswordDialog";
import { db, router } from "@tests/mocks/supabase";

it("change password verifies current password and signs out after successful update",async()=>{
  render(<ChangePasswordDialog/>);await userEvent.click(screen.getByRole("button",{name:"Change Password"}));
  await userEvent.type(screen.getByLabelText(/Current Password/),"old-password-123");await userEvent.type(screen.getByLabelText(/^New Password/),"new-password-123");await userEvent.type(screen.getByLabelText(/Confirm New/),"new-password-123");await userEvent.click(screen.getByRole("button",{name:"Update Password"}));
  expect(db.auth.updateUser).toHaveBeenCalledWith({password:"new-password-123",current_password:"old-password-123"});expect(db.auth.signOut).toHaveBeenCalledWith({scope:"global"});expect(router.replace).toHaveBeenCalledWith("/login?reset=1");
});

it("change password mismatch never reaches Supabase",async()=>{
  render(<ChangePasswordDialog/>);await userEvent.click(screen.getByRole("button",{name:"Change Password"}));await userEvent.type(screen.getByLabelText(/Current Password/),"old-password-123");await userEvent.type(screen.getByLabelText(/^New Password/),"new-password-123");await userEvent.type(screen.getByLabelText(/Confirm New/),"different-password");await userEvent.click(screen.getByRole("button",{name:"Update Password"}));expect(await screen.findByRole("alert")).toHaveTextContent("Passwords don't match");expect(db.auth.updateUser).not.toHaveBeenCalled();
});
