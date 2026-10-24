import { expect,it,vi } from "vitest";
import { render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SelectionCheckbox } from "./SelectionCheckbox";

it("the larger surrounding target toggles selection without opening the row",async()=>{
  const rowClick=vi.fn();
  function Row(){const [checked,setChecked]=useState(false);return <div onClick={rowClick}><SelectionCheckbox label="Select invoice" checked={checked} onChange={setChecked}/></div>;}
  render(<Row/>);const checkbox=screen.getByRole("checkbox",{name:"Select invoice"});
  await userEvent.click(checkbox.closest("label")!);expect(checkbox).toBeChecked();expect(rowClick).not.toHaveBeenCalled();
  checkbox.focus();await userEvent.keyboard(" ");expect(checkbox).not.toBeChecked();expect(rowClick).not.toHaveBeenCalled();
});

it("disabled checkboxes do not select or open the row",async()=>{
  const change=vi.fn(),rowClick=vi.fn();
  render(<div onClick={rowClick}><SelectionCheckbox label="Unavailable invoice" checked={false} disabled onChange={change}/></div>);
  const checkbox=screen.getByRole("checkbox");await userEvent.click(checkbox.closest("label")!);
  expect(checkbox).toBeDisabled();expect(change).not.toHaveBeenCalled();expect(rowClick).not.toHaveBeenCalled();
});
