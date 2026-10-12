import { expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BranchOrder from "@/app/branch/order/page";
import { profile, item, workspace } from "@tests/mocks/fixtures";
import { db, queryResult, router } from "@tests/mocks/supabase";

it("branch order requires review before submitting selected items",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});const orderQuery=queryResult({id:"new-order"});const linesQuery=queryResult(null);
  db.from.mockImplementation(table=>table==="profiles"?queryResult(profile):table==="catalog_items"?queryResult([item]):table==="orders"?orderQuery:linesQuery);db.rpc.mockReturnValue(queryResult(workspace));
  render(<BranchOrder/>);await userEvent.click(await screen.findByRole("button",{name:`Increase ${item.name}`}));await userEvent.click(screen.getByRole("button",{name:"Place Order"}));expect(orderQuery.insert).not.toHaveBeenCalled();const dialog=screen.getByRole("dialog");expect(within(dialog).getByText(item.name)).toBeVisible();await userEvent.click(within(dialog).getByRole("button",{name:"Submit Order"}));await waitFor(()=>expect(router.push).toHaveBeenCalledWith("/branch/invoices"));expect(linesQuery.insert).toHaveBeenCalledWith([expect.objectContaining({order_id:"new-order",item_id:item.id,quantity:1})]);
});
