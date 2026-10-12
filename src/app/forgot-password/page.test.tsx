import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPassword from "@/app/forgot-password/page";
import { db } from "@tests/mocks/supabase";

it("forgot password requests the configured callback instead of pretending to send",async()=>{
  render(<ForgotPassword/>);await userEvent.type(screen.getByLabelText("Email"),"manager@example.invalid");await userEvent.click(screen.getByRole("button",{name:"Send Reset Link"}));expect(await screen.findByText("Check your inbox")).toBeVisible();expect(db.auth.resetPasswordForEmail).toHaveBeenCalledWith("manager@example.invalid",{redirectTo:`${window.location.origin}/auth/confirm`});
});

it("email delivery errors do not show success",async()=>{
  db.auth.resetPasswordForEmail.mockResolvedValue({error:new Error("Email rate limit reached")});render(<ForgotPassword/>);await userEvent.type(screen.getByLabelText("Email"),"manager@example.invalid");await userEvent.click(screen.getByRole("button",{name:"Send Reset Link"}));expect(await screen.findByText("Email rate limit reached")).toBeVisible();expect(screen.queryByText("Check your inbox")).not.toBeInTheDocument();
});
