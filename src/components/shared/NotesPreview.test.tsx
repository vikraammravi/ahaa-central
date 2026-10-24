import { expect,it } from "vitest";
import { render,screen,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotesPreview } from "./NotesPreview";
import { cateringNotes,cateringEvent } from "@tests/mocks/fixtures";

it("opens full notes in a scrollable dialog preserving entered order and restores focus when closed",async()=>{
  render(<NotesPreview text={cateringNotes} title={`Notes — ${cateringEvent.customer_name}`} description="Catering booking"/>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const trigger=screen.getByRole("button",{name:"View Notes"});await userEvent.click(trigger);
  const dialog=screen.getByRole("dialog",{name:`Notes — ${cateringEvent.customer_name}`});
  const notes=within(dialog).getByRole("region",{name:"Full notes"});
  expect(notes.textContent).toBe(cateringNotes);expect(notes).toHaveClass("whitespace-pre-wrap","overflow-y-auto","[overflow-wrap:anywhere]");
  expect(within(dialog).queryByRole("button",{name:"Close Notes"})).not.toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button",{name:/^Close$/}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();expect(trigger).toHaveFocus();
});
