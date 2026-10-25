import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { UsersTable } from "@/components/admin/UsersTable";
import { branch, profile } from "@tests/mocks/fixtures";
import userEvent from "@testing-library/user-event";

it("users table separates email and keeps the requested column order",()=>{
  render(<UsersTable profiles={[profile]} locations={[branch]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  expect(screen.getAllByRole("columnheader").map(cell=>cell.textContent)).toEqual(["Name","Role","Email","Branch","Phone","Status",""]);
  expect(screen.getByText(profile.email!)).toBeVisible();
});

it("user deletion requires explicit confirmation",async()=>{
  const remove=vi.fn();render(<UsersTable profiles={[profile]} locations={[branch]} loading={false} onEdit={vi.fn()} onDelete={remove}/>);
  await userEvent.click(screen.getByRole("button",{name:"Delete"}));
  expect(remove).not.toHaveBeenCalled();await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Delete"}));expect(remove).toHaveBeenCalledWith(profile.id);
});
