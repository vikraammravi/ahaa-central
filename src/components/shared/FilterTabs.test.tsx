import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterTabs } from "@/components/shared/FilterTabs";

it("filter tabs return the selected value",async()=>{
    const change=vi.fn();render(<FilterTabs tabs={[{value:"orders",label:"Individual"},{value:"combined",label:"Combined",count:3}]} value="orders" onChange={change}/>);
    await userEvent.click(screen.getByRole("button",{name:/Combined.*3/}));expect(change).toHaveBeenCalledWith("combined");
  });
