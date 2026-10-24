import { expect,it,vi } from "vitest";
import { render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RowActions } from "./RowActions";
import { mockViewport } from "@tests/mocks/viewport";
import { profile } from "@tests/mocks/fixtures";

it.each([390,820])("compact actions expose Edit and confirm deletion at %spx",async width=>{
  mockViewport(width);const edit=vi.fn(),remove=vi.fn();
  render(<RowActions onEdit={edit} onDelete={remove} deleteTitle={`Delete ${profile.full_name}?`}/>);
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));expect(edit).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button",{name:"Delete"}));
  expect(screen.getByRole("dialog",{name:`Delete ${profile.full_name}?`})).toBeVisible();expect(remove).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button",{name:"Cancel"}));expect(remove).not.toHaveBeenCalled();
});
