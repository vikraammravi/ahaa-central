import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormDialog } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

it("form errors keep the dialog open and allow retry",async()=>{
    const submit=vi.fn().mockRejectedValueOnce(new Error("Stock changed")).mockResolvedValue(undefined);
    render(<FormDialog trigger={<Button>Open Form</Button>} title="Update Stock" onSubmit={submit}><p>Fields</p></FormDialog>);
    await userEvent.click(screen.getByText("Open Form"));await userEvent.click(screen.getByRole("button",{name:"Save"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Stock changed");
    await userEvent.click(screen.getByRole("button",{name:"Save"}));expect(submit).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
