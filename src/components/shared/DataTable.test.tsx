import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DataTable } from "@/components/shared/DataTable";
import userEvent from "@testing-library/user-event";

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
