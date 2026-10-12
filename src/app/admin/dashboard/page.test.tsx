import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminDashboard from "@/app/admin/dashboard/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { item } from "@tests/mocks/fixtures";

it("dashboard displays server summary and stock warnings",async()=>{
  db.rpc.mockReturnValue(queryResult({ordersToday:3,pendingOrders:2,revenueToday:150,lowStock:1,lowItems:[item],recentOrders:[],businessDate:"2026-10-12"}));render(<AdminDashboard/>);expect(await screen.findByText("CA$150.00")).toBeVisible();expect(screen.getByText("Idli Batter")).toBeVisible();expect(screen.getByRole("link",{name:"Manage stock"})).toHaveAttribute("href","/admin/stock");
});
