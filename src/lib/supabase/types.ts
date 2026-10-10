import type { DatabaseEnums, DatabaseTables } from "./database.generated";

export type UserRole = DatabaseEnums["user_role"];
export type ProfileStatus = DatabaseEnums["profile_status"];
export type UnitMeasurement = DatabaseEnums["unit_measurement"];
export type OrderStatus = DatabaseEnums["order_status"];
export type CateringStatus = DatabaseEnums["catering_status"];
type Row<Name extends keyof DatabaseTables> = DatabaseTables[Name]["Row"];
// Domain models retain the application's defaults; generated storage types
// separately describe the database's nullable columns and insert/update shapes.
type WithDefaults<T, Keys extends keyof T> = Omit<T, Keys> & { [Key in Keys]: NonNullable<T[Key]> };

export type Location = WithDefaults<Row<"locations">, "is_central" | "created_at">;
export type Profile = WithDefaults<Row<"profiles">, "full_name" | "created_at" | "updated_at">;
export type CatalogItem = WithDefaults<Row<"catalog_items">, "available_stock" | "is_active" | "is_taxable" | "updated_at">;
export type Order = Omit<WithDefaults<Row<"orders">, "status" | "order_date" | "created_at" | "updated_at">, "pickup_approval_status" | "invoice_published_lines"> & {
  pickup_approval_status: "PENDING" | "APPROVED" | "REJECTED" | null;
  invoice_published_lines: InvoicePublishedLine[] | null;
};
export type OrderLine = WithDefaults<Row<"order_lines">, "final_line_total">;
export type CateringEvent = WithDefaults<Row<"catering_events">, "advance_paid" | "status" | "created_at" | "updated_at">;
export type PickupRequestLine = Row<"pickup_request_lines">;
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
};
