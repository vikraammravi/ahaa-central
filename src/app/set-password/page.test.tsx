import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SetPassword from "@/app/set-password/page";
import { db } from "@tests/mocks/supabase";
import userEvent from "@testing-library/user-event";
import { profile } from "@tests/mocks/fixtures";

it("expired reset sessions disable password submission",async()=>{
  render(<SetPassword/>);expect(await screen.findByText(/link is invalid or expired/)).toBeVisible();expect(screen.getByRole("button",{name:"Continue"})).toBeDisabled();expect(db.auth.updateUser).not.toHaveBeenCalled();
});

it("authenticated password update saves and signs out",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});render(<SetPassword/>);await waitFor(()=>expect(screen.getByLabelText("New Password")).toBeEnabled());await userEvent.type(screen.getByLabelText("New Password"),"new-password-123");await userEvent.type(screen.getByLabelText("Confirm Password"),"new-password-123");await userEvent.click(screen.getByRole("button",{name:"Continue"}));expect(db.auth.updateUser).toHaveBeenCalledWith({password:"new-password-123"});expect(db.auth.signOut).toHaveBeenCalledWith({scope:"global"});
});
