import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "@/app/login/page";
import { profile } from "@tests/mocks/fixtures";
import { db, queryResult, router } from "@tests/mocks/supabase";

it("login removes activation links and routes active employees to inventory",async()=>{
  db.auth.signInWithPassword.mockResolvedValue({data:{user:{id:"user"}},error:null});db.from.mockReturnValue(queryResult({...profile,role:"BRANCH_EMPLOYEE"}));render(<Login/>);
  expect(screen.queryByRole("link",{name:/Activate/})).not.toBeInTheDocument();await userEvent.type(screen.getByLabelText("Email"),profile.email!);await userEvent.type(screen.getByLabelText("Password"),"test-password-123");await userEvent.click(screen.getByRole("button",{name:"Sign In"}));expect(router.replace).toHaveBeenCalledWith("/employee/inventory");
});

it("inactive accounts cannot enter the app",async()=>{
  db.auth.signInWithPassword.mockResolvedValue({data:{user:{id:"user"}},error:null});db.from.mockReturnValue(queryResult({...profile,status:"disabled"}));render(<Login/>);await userEvent.type(screen.getByLabelText("Email"),profile.email!);await userEvent.type(screen.getByLabelText("Password"),"test-password-123");await userEvent.click(screen.getByRole("button",{name:"Sign In"}));expect(await screen.findByText(/account is not active/)).toBeVisible();expect(router.replace).not.toHaveBeenCalled();expect(db.auth.signOut).toHaveBeenCalled();
});

it("password visibility toggles without submitting or changing the password",async()=>{
  render(<Login/>);const input=screen.getByLabelText("Password");
  await userEvent.type(input,"test-password-123");expect(input).toHaveAttribute("type","password");
  await userEvent.click(screen.getByRole("button",{name:"Show password"}));
  expect(input).toHaveAttribute("type","text");expect(input).toHaveValue("test-password-123");
  expect(db.auth.signInWithPassword).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button",{name:"Hide password"}));expect(input).toHaveAttribute("type","password");
});
