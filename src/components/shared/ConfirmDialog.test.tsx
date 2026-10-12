import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

it("confirmation never deletes on cancellation",async()=>{
    const remove=vi.fn();render(<ConfirmDialog trigger={<Button>Remove User</Button>} title="Delete account?" onConfirm={remove}/>);
    await userEvent.click(screen.getByText("Remove User"));await userEvent.click(screen.getByRole("button",{name:"Cancel"}));expect(remove).not.toHaveBeenCalled();
  });

it("confirmation failures show an error without closing",async()=>{
    render(<ConfirmDialog trigger={<Button>Remove</Button>} title="Delete account?" onConfirm={vi.fn().mockRejectedValue(new Error("Not permitted"))}/>);
    await userEvent.click(screen.getByText("Remove"));await userEvent.click(screen.getByRole("button",{name:"Confirm"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not permitted");expect(screen.getByRole("dialog")).toBeVisible();
  });
