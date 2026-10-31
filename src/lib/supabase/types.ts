import type { InvoicePaymentRecord } from "../payments";
import type { DatabaseEnums, DatabaseTables } from "./database.generated";

export type UserRole = DatabaseEnums["user_role"];
export type ProfileStatus = DatabaseEnums["profile_status"];
export type UnitMeasurement = string;
export type OrderStatus = DatabaseEnums["order_status"];
export type CateringStatus = DatabaseEnums["catering_status"];
type Row<Name extends keyof DatabaseTables> = DatabaseTables[Name]["Row"];
// Domain models retain the application's defaults; generated storage types
// separately describe the database's nullable columns and insert/update shapes.
type WithDefaults<T, Keys extends keyof T> = Omit<T, Keys> & { [Key in Keys]: NonNullable<T[Key]> };

export type Location = WithDefaults<Row<"locations">, "is_central" | "created_at">;
export type Profile = WithDefaults<Row<"profiles">, "full_name" | "created_at" | "updated_at">;
export type CatalogItem = WithDefaults<Row<"catalog_items">, "available_stock" | "is_active" | "is_taxable" | "updated_at">;
export type Order = Omit<WithDefaults<Row<"orders">, "status" | "order_date" | "created_at" | "updated_at">, "pickup_approval_status"> & {
  pickup_approval_status: "PENDING" | "APPROVED" | "REJECTED" | null;
  weekly_invoice_id: string | null;
  pickup_confirmed_by: string | null;
  pickup_confirmed_at: string | null;
};
export type OrderLine = WithDefaults<Row<"order_lines">, "final_line_total"> & { invoice_quantity: number | null; invoice_is_taxable: boolean | null; invoice_line_total: number };
export type CateringFulfillment = "PICKUP" | "DELIVERY";
export type CateringEvent = Omit<WithDefaults<Row<"catering_events">, "advance_paid" | "status" | "created_at" | "updated_at">,"fulfillment_method"> & {fulfillment_method:CateringFulfillment};
export type PickupRequestLine = Row<"pickup_request_lines"> & { extra_stock_debited: number; allocation_shortfall: number; return_quantity: number };
export type InvoicePublishedLine = OrderLine & { catalog_items: { name: string; unit_type: string } | null };
export type InvoiceEdit = Omit<Row<"invoice_edits">, "previous_lines" | "updated_lines" | "stock_adjustments"> & {
  edited_profile: { full_name: string } | null;
  previous_lines: InvoicePublishedLine[];
  updated_lines: InvoicePublishedLine[];
  stock_adjustments: { line_id: string; adjustment: number; return_to_stock: boolean | null; previous_quantity: number; quantity: number }[];
};
export type PickupRequest = Omit<Row<"pickup_requests">, "status"> & {
  status: "PENDING" | "APPROVED" | "REJECTED";
  pickup_request_lines: PickupRequestLine[];
  requested_profile: { full_name: string } | null;
  reviewed_profile: { full_name: string } | null;
  already_collected: boolean;
  return_status: "PENDING" | "RECEIVED" | null;
  return_note: string | null;
  return_received_at: string | null;
  return_received_by: string | null;
};

export type WeeklyInvoice = Omit<Row<"weekly_invoices">,"payment_status"> & InvoicePaymentRecord & {
  locations: { name: string } | null; orders: { id: string }[];
};
export type WeeklyInvoiceDetails = {
  id: string; branch_name: string; start_date: string; end_date: string; revision: number; sent_at: string | null;
  subtotal: number; tax: number; total: number;
  lines: { item_id: string; name: string; unit_type: string; quantity: number; unit_price: number; is_taxable: boolean; subtotal: number; tax: number }[];
  orders: { id: string; order_number: number; order_date: string; total: number }[];
};
