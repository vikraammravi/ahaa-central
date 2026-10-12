import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormSelect } from "@/components/shared/FormSelect";

it("select fields preserve option values",async()=>{
    const change=vi.fn();render(<FormSelect aria-label="Category" options={["Grocery","Podi"]} value="Grocery" onChange={change}/>);
    await userEvent.selectOptions(screen.getByRole("combobox"),"Podi");expect(change).toHaveBeenCalledWith("Podi");
  });
