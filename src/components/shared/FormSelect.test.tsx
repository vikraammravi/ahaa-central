import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormSelect } from "@/components/shared/FormSelect";
import { useState } from "react";
import { FilterBar } from "./FilterBar";
import { mockViewport } from "@tests/mocks/viewport";
import { branch } from "@tests/mocks/fixtures";

function Filters(){const [value,setValue]=useState("");return <FilterBar><label htmlFor="test-branch">Branch<FormSelect id="test-branch" options={[{value:"",label:"All branches"},{value:branch.id,label:branch.name}]} value={value} onChange={setValue}/></label><FormSelect aria-label="Disabled status" disabled options={["Active"]} value="Active" onChange={()=>{}}/></FilterBar>;}
it.each([320,820,1440])("filter dropdowns preserve labels, selection and disabled behaviour at %spx",async width=>{
  mockViewport(width);render(<Filters/>);
  if(width<1024)await userEvent.click(screen.getByRole("button",{name:"Search & filters"}));
  const dropdown=screen.getByLabelText("Branch");await userEvent.selectOptions(dropdown,branch.id);
  expect(dropdown).toHaveValue(branch.id);
  expect(screen.getByLabelText("Disabled status")).toBeDisabled();
  await userEvent.selectOptions(dropdown,"");expect(dropdown).toHaveValue("");
  if(width<1024){await userEvent.click(screen.getByRole("button",{name:"Show results"}));expect(screen.queryByRole("dialog")).not.toBeInTheDocument();}
});

it("select fields preserve option values",async()=>{
    const change=vi.fn();render(<FormSelect aria-label="Category" options={["Grocery","Podi"]} value="Grocery" onChange={change}/>);
    await userEvent.selectOptions(screen.getByRole("combobox"),"Podi");expect(change).toHaveBeenCalledWith("Podi");
  });
