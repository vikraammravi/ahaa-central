import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "@/components/shared/Pagination";

it("pagination protects boundaries and busy requests",async()=>{
    const change=vi.fn();const view=render(<Pagination page={0} pageSize={25} count={26} onChange={change}/>);
    expect(screen.getByRole("button",{name:"Previous"})).toBeDisabled();
    await userEvent.click(screen.getByRole("button",{name:"Next"}));expect(change).toHaveBeenCalledWith(1);
    view.rerender(<Pagination page={1} pageSize={25} count={26} busy onChange={change}/>);
    expect(screen.getByText("26–26 of 26")).toBeVisible();expect(screen.getByRole("button",{name:"Next"})).toBeDisabled();expect(screen.getByRole("button",{name:"Previous"})).toBeDisabled();
  });
