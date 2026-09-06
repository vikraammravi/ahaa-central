// Hand-authored DB types mirroring the Supabase schema.
// Later: replace with `npx supabase gen types typescript` output.

export type UserRole = "CENTRAL_ADMIN" | "BRANCH_MANAGER";
export type ProfileStatus = "active" | "pending" | "disabled";
export type UnitMeasurement = "Bucket" | "Tray" | "Piece" | "Can";
export type OrderStatus =
  | "SUBMITTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";
export type CateringStatus =
  | "INQUIRY"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";

export type Location = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_central: boolean;
  city: string | null;
  province: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  location_id: string | null;
  status: ProfileStatus;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  category: string;
  unit_type: UnitMeasurement;
  default_price: number;
  is_taxable: boolean;
  available_stock: number;
  is_active: boolean;
  updated_at: string;
};

export type Order = {
  id: string;
  order_number: number;
  location_id: string;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  final_subtotal: number;
  final_tax_amount: number;
  final_total_amount: number;
  order_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderLine = {
  id: string;
  order_id: string;
  item_id: string;
  quantity: number;
  fulfilled_quantity: number;
  unit_price: number;
  is_taxable: boolean;
  line_total: number;
  final_line_total: number;
  shortage_reason: string | null;
};

export type CateringEvent = {
  id: string;
  location_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  event_datetime: string;
  total_amount: number;
  advance_paid: number;
  balance_due: number;
  status: CateringStatus;
  checklist: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
