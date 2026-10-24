import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DataTable } from "@/components/shared/DataTable";
import userEvent from "@testing-library/user-event";
import { mockViewport } from "@tests/mocks/viewport";
import { profile } from "@tests/mocks/fixtures";

it.each([320,768,1023])("cards at %spx include fields normally hidden in tables and preserve actions",async width=>{
  mockViewport(width);const edit=vi.fn();const view=vi.fn();
  render(<DataTable data={[profile]} columns={[
    {key:"name",header:"Name",render:row=>row.full_name},
    {key:"email",header:"Email",hideOn:"md",render:row=>row.email},
    {key:"actions",header:"",render:row=><button onClick={()=>edit(row.id)}>Edit user</button>},
  ]} rowKey={row=>row.id} onRowClick={view} toolbar={<p>Filters</p>} footer={<p>Totals</p>} expandedContent={()=>"Expanded history"}/>);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText(profile.email!)).toBeVisible();expect(screen.getByText("Expanded history")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Edit user"}));expect(edit).toHaveBeenCalledWith(profile.id);expect(view).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button",{name:"View details"}));expect(view).toHaveBeenCalledWith(profile);
  expect(screen.getByText("Filters")).toBeVisible();expect(screen.getByText("Totals")).toBeVisible();
});

const columns=[{key:"name",header:"Name",render:(row:{id:string;name:string})=>row.name}];

it("shows loading then empty content instead of stale rows",()=>{
    const view=render(<DataTable data={null} columns={columns} loading rowKey={r=>r.id}/>);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    view.rerender(<DataTable data={[]} columns={columns} rowKey={r=>r.id} emptyTitle="No invoices"/>);
    expect(screen.getByText("No invoices")).toBeVisible();
  });

it("renders expandable content and forwards the clicked record",async()=>{
    const row={id:"1",name:"Invoice 1"};const click=vi.fn();
    render(<DataTable data={[row]} columns={columns} rowKey={r=>r.id} onRowClick={click} expandedContent={()=>"Order 12"}/>);
    await userEvent.click(screen.getByText("Invoice 1"));
    expect(click).toHaveBeenCalledWith(row);expect(screen.getByText("Order 12")).toBeVisible();
  });

it("tables expose headers to assistive technology",()=>{render(<DataTable data={[{id:"1",name:"Manager"}]} columns={[{key:"name",header:"Name",render:r=>r.name}]} rowKey={r=>r.id}/>);expect(within(screen.getByRole("table")).getByRole("columnheader",{name:"Name"})).toBeVisible();});
