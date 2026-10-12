import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateBranchUserDialog } from "@/components/admin/CreateBranchUserDialog";
import { branch } from "@tests/mocks/fixtures";

it.each(["BRANCH_MANAGER","BRANCH_EMPLOYEE"] as const)("creates %s through the admin endpoint with the selected branch",async role=>{
  const fetchMock=vi.mocked(fetch);fetchMock.mockResolvedValue(new Response(JSON.stringify({id:"created"}),{status:201}));const created=vi.fn();
  render(<CreateBranchUserDialog locations={[branch]} open onOpenChange={vi.fn()} onCreated={created}/>);
  await userEvent.selectOptions(screen.getByLabelText(/Role/),role);
  await userEvent.type(screen.getByLabelText(/Full Name/),"New User");await userEvent.type(screen.getByLabelText(/Email/),"user@example.invalid");
  await userEvent.selectOptions(screen.getByRole("combobox",{name:/^Branch/}),branch.id);await userEvent.type(screen.getByLabelText(/Starting Password/),"A-test-password-123");
  await userEvent.click(screen.getByRole("button",{name:"Create User"}));expect(created).toHaveBeenCalled();
  const input=JSON.parse(fetchMock.mock.calls[0][1]?.body as string);expect(input).toMatchObject({role,locationId:branch.id});
});

it("account creation failures remain visible without a success callback",async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({error:"Email already exists"}),{status:400}));const created=vi.fn();
  render(<CreateBranchUserDialog locations={[branch]} open onOpenChange={vi.fn()} onCreated={created}/>);
  await userEvent.type(screen.getByLabelText(/Full Name/),"New User");await userEvent.type(screen.getByLabelText(/Email/),"user@example.invalid");await userEvent.selectOptions(screen.getByRole("combobox",{name:/^Branch/}),branch.id);await userEvent.type(screen.getByLabelText(/Starting Password/),"A-test-password-123");await userEvent.click(screen.getByRole("button",{name:"Create User"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Email already exists");expect(created).not.toHaveBeenCalled();
});
