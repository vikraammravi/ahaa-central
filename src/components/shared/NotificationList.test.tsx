import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationList } from "@/components/shared/NotificationList";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch } from "@tests/mocks/fixtures";

it("legacy notification component derives pending orders without its own table",async()=>{
  db.from.mockImplementation(table=>queryResult(table==="orders"?[{id:"order",order_number:12,created_at:new Date().toISOString(),locations:{name:branch.name}}]:[]));render(<NotificationList audience="admin"/>);expect(await screen.findByText("New branch order")).toBeVisible();expect(db.from).not.toHaveBeenCalledWith("notifications");
});
