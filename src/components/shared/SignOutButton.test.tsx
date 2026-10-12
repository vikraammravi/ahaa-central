import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { db, router } from "@tests/mocks/supabase";

it("sign out removes the local session and returns to login",async()=>{
  render(<SignOutButton/>);await userEvent.click(screen.getByRole("button",{name:"Sign Out"}));expect(db.auth.signOut).toHaveBeenCalled();expect(router.replace).toHaveBeenCalledWith("/login");
});
