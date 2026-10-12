// Generated from supabase/schema.snapshot.json. Run node scripts/generate-database-types.mjs to refresh.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type DatabaseEnums = {
  "user_role": "CENTRAL_ADMIN" | "BRANCH_MANAGER" | "BRANCH_EMPLOYEE";
  "order_status": "SUBMITTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  "profile_status": "active" | "pending" | "disabled";
  "catering_status": "INQUIRY" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  "unit_measurement": "Bucket" | "Tray" | "Piece" | "Can" | "Box" | "Bottle" | "Bag";
};

export type DatabaseTables = {
  "branch_inventory_counts": {
    Row: {
      "id": string;
      "location_id": string;
      "count_date": string;
      "submitted_by": string | null;
      "submitted_name": string;
      "submitted_at": string;
      "notes": string;
      "flow_version": number;
      "received_until": string;
    };
    Insert: {
      "id"?: string;
      "location_id": string;
      "count_date": string;
      "submitted_by"?: string | null;
      "submitted_name": string;
      "submitted_at"?: string;
      "notes"?: string;
      "flow_version"?: number;
      "received_until"?: string;
    };
    Update: {
      "id"?: string;
      "location_id"?: string;
      "count_date"?: string;
      "submitted_by"?: string | null;
      "submitted_name"?: string;
      "submitted_at"?: string;
      "notes"?: string;
      "flow_version"?: number;
      "received_until"?: string;
    };
  };
  "branch_inventory_lines": {
    Row: {
      "id": string;
      "count_id": string;
      "item_id": string;
      "item_name": string;
      "unit_type": string;
      "quantity": number;
      "opening_quantity": number | null;
      "received_quantity": number | null;
      "used_quantity": number | null;
      "wasted_quantity": number | null;
      "adjustment_quantity": number | null;
    };
    Insert: {
      "id"?: string;
      "count_id": string;
      "item_id": string;
      "item_name": string;
      "unit_type": string;
      "quantity": number;
      "opening_quantity"?: number | null;
      "received_quantity"?: number | null;
      "used_quantity"?: number | null;
      "wasted_quantity"?: number | null;
      "adjustment_quantity"?: number | null;
    };
    Update: {
      "id"?: string;
      "count_id"?: string;
      "item_id"?: string;
      "item_name"?: string;
      "unit_type"?: string;
      "quantity"?: number;
      "opening_quantity"?: number | null;
      "received_quantity"?: number | null;
      "used_quantity"?: number | null;
      "wasted_quantity"?: number | null;
      "adjustment_quantity"?: number | null;
    };
  };
  "catalog_items": {
    Row: {
      "id": string;
      "name": string;
      "category": string;
      "unit_type": DatabaseEnums["unit_measurement"];
      "default_price": number;
      "is_taxable": boolean | null;
      "available_stock": number | null;
      "is_active": boolean | null;
      "updated_at": string | null;
      "low_stock_threshold": number;
    };
    Insert: {
      "id"?: string;
      "name": string;
      "category": string;
      "unit_type": DatabaseEnums["unit_measurement"];
      "default_price": number;
      "is_taxable"?: boolean | null;
      "available_stock"?: number | null;
      "is_active"?: boolean | null;
      "updated_at"?: string | null;
      "low_stock_threshold"?: number;
    };
    Update: {
      "id"?: string;
      "name"?: string;
      "category"?: string;
      "unit_type"?: DatabaseEnums["unit_measurement"];
      "default_price"?: number;
      "is_taxable"?: boolean | null;
      "available_stock"?: number | null;
      "is_active"?: boolean | null;
      "updated_at"?: string | null;
      "low_stock_threshold"?: number;
    };
  };
  "catering_events": {
    Row: {
      "id": string;
      "location_id": string;
      "customer_name": string;
      "customer_phone": string;
      "guest_count": number;
      "event_datetime": string;
      "total_amount": number;
      "advance_paid": number | null;
      "balance_due": number;
      "status": DatabaseEnums["catering_status"] | null;
      "checklist": Json | null;
      "notes": string | null;
      "created_at": string | null;
      "updated_at": string | null;
    };
    Insert: {
      "id"?: string;
      "location_id": string;
      "customer_name": string;
      "customer_phone": string;
      "guest_count": number;
      "event_datetime": string;
      "total_amount": number;
      "advance_paid"?: number | null;
      "balance_due": number;
      "status"?: DatabaseEnums["catering_status"] | null;
      "checklist"?: Json | null;
      "notes"?: string | null;
      "created_at"?: string | null;
      "updated_at"?: string | null;
    };
    Update: {
      "id"?: string;
      "location_id"?: string;
      "customer_name"?: string;
      "customer_phone"?: string;
      "guest_count"?: number;
      "event_datetime"?: string;
      "total_amount"?: number;
      "advance_paid"?: number | null;
      "balance_due"?: number;
      "status"?: DatabaseEnums["catering_status"] | null;
      "checklist"?: Json | null;
      "notes"?: string | null;
      "created_at"?: string | null;
      "updated_at"?: string | null;
    };
  };
  "invoice_edits": {
    Row: {
      "id": string;
      "order_id": string;
      "revision": number;
      "edited_by": string | null;
      "edited_at": string;
      "reason": string;
      "previous_lines": Json;
      "updated_lines": Json;
      "stock_adjustments": Json;
    };
    Insert: {
      "id"?: string;
      "order_id": string;
      "revision": number;
      "edited_by"?: string | null;
      "edited_at"?: string;
      "reason": string;
      "previous_lines": Json;
      "updated_lines": Json;
      "stock_adjustments": Json;
    };
    Update: {
      "id"?: string;
      "order_id"?: string;
      "revision"?: number;
      "edited_by"?: string | null;
      "edited_at"?: string;
      "reason"?: string;
      "previous_lines"?: Json;
      "updated_lines"?: Json;
      "stock_adjustments"?: Json;
    };
  };
  "locations": {
    Row: {
      "id": string;
      "name": string;
      "address": string | null;
      "phone": string | null;
      "is_central": boolean | null;
      "created_at": string | null;
      "city": string | null;
      "province": string | null;
    };
    Insert: {
      "id"?: string;
      "name": string;
      "address"?: string | null;
      "phone"?: string | null;
      "is_central"?: boolean | null;
      "created_at"?: string | null;
      "city"?: string | null;
      "province"?: string | null;
    };
    Update: {
      "id"?: string;
      "name"?: string;
      "address"?: string | null;
      "phone"?: string | null;
      "is_central"?: boolean | null;
      "created_at"?: string | null;
      "city"?: string | null;
      "province"?: string | null;
    };
  };
  "order_lines": {
    Row: {
      "id": string;
      "order_id": string;
      "item_id": string;
      "quantity": number;
      "unit_price": number;
      "is_taxable": boolean;
      "line_total": number;
      "fulfilled_quantity": number;
      "shortage_reason": string | null;
      "final_line_total": number | null;
      "invoice_quantity": number | null;
      "invoice_is_taxable": boolean | null;
      "invoice_line_total": number | null;
    };
    Insert: {
      "id"?: string;
      "order_id": string;
      "item_id": string;
      "quantity": number;
      "unit_price": number;
      "is_taxable": boolean;
      "line_total": number;
      "fulfilled_quantity"?: number;
      "shortage_reason"?: string | null;
      "final_line_total"?: never;
      "invoice_quantity"?: number | null;
      "invoice_is_taxable"?: boolean | null;
      "invoice_line_total"?: never;
    };
    Update: {
      "id"?: string;
      "order_id"?: string;
      "item_id"?: string;
      "quantity"?: number;
      "unit_price"?: number;
      "is_taxable"?: boolean;
      "line_total"?: number;
      "fulfilled_quantity"?: number;
      "shortage_reason"?: string | null;
      "final_line_total"?: never;
      "invoice_quantity"?: number | null;
      "invoice_is_taxable"?: boolean | null;
      "invoice_line_total"?: never;
    };
  };
  "orders": {
    Row: {
      "id": string;
      "order_number": number;
      "location_id": string;
      "status": DatabaseEnums["order_status"] | null;
      "subtotal": number;
      "tax_amount": number;
      "total_amount": number;
      "order_date": string | null;
      "created_by": string | null;
      "created_at": string | null;
      "updated_at": string | null;
      "final_subtotal": number;
      "final_tax_amount": number;
      "final_total_amount": number;
      "stock_deducted_at": string | null;
      "pickup_approval_status": string | null;
      "invoice_revision": number;
      "pickup_confirmed_by": string | null;
      "pickup_confirmed_at": string | null;
      "weekly_invoice_id": string | null;
    };
    Insert: {
      "id"?: string;
      "order_number"?: number;
      "location_id": string;
      "status"?: DatabaseEnums["order_status"] | null;
      "subtotal"?: number;
      "tax_amount"?: number;
      "total_amount"?: number;
      "order_date"?: string | null;
      "created_by"?: string | null;
      "created_at"?: string | null;
      "updated_at"?: string | null;
      "final_subtotal"?: number;
      "final_tax_amount"?: number;
      "final_total_amount"?: number;
      "stock_deducted_at"?: string | null;
      "pickup_approval_status"?: string | null;
      "invoice_revision"?: number;
      "pickup_confirmed_by"?: string | null;
      "pickup_confirmed_at"?: string | null;
      "weekly_invoice_id"?: string | null;
    };
    Update: {
      "id"?: string;
      "order_number"?: number;
      "location_id"?: string;
      "status"?: DatabaseEnums["order_status"] | null;
      "subtotal"?: number;
      "tax_amount"?: number;
      "total_amount"?: number;
      "order_date"?: string | null;
      "created_by"?: string | null;
      "created_at"?: string | null;
      "updated_at"?: string | null;
      "final_subtotal"?: number;
      "final_tax_amount"?: number;
      "final_total_amount"?: number;
      "stock_deducted_at"?: string | null;
      "pickup_approval_status"?: string | null;
      "invoice_revision"?: number;
      "pickup_confirmed_by"?: string | null;
      "pickup_confirmed_at"?: string | null;
      "weekly_invoice_id"?: string | null;
    };
  };
  "pickup_request_lines": {
    Row: {
      "id": string;
      "request_id": string;
      "order_line_id": string;
      "item_id": string;
      "prepared_quantity": number;
      "pickup_quantity": number;
      "return_to_stock": boolean | null;
      "stock_adjustment": number;
      "extra_stock_debited": number;
      "allocation_shortfall": number;
      "return_quantity": number;
    };
    Insert: {
      "id"?: string;
      "request_id": string;
      "order_line_id": string;
      "item_id": string;
      "prepared_quantity": number;
      "pickup_quantity": number;
      "return_to_stock"?: boolean | null;
      "stock_adjustment"?: number;
      "extra_stock_debited"?: number;
      "allocation_shortfall"?: number;
      "return_quantity"?: number;
    };
    Update: {
      "id"?: string;
      "request_id"?: string;
      "order_line_id"?: string;
      "item_id"?: string;
      "prepared_quantity"?: number;
      "pickup_quantity"?: number;
      "return_to_stock"?: boolean | null;
      "stock_adjustment"?: number;
      "extra_stock_debited"?: number;
      "allocation_shortfall"?: number;
      "return_quantity"?: number;
    };
  };
  "pickup_requests": {
    Row: {
      "id": string;
      "order_id": string;
      "status": string;
      "reason": string;
      "requested_by": string | null;
      "requested_at": string;
      "reviewed_by": string | null;
      "reviewed_at": string | null;
      "review_note": string | null;
      "already_collected": boolean;
      "return_status": string | null;
      "return_received_at": string | null;
      "return_received_by": string | null;
      "return_note": string | null;
    };
    Insert: {
      "id"?: string;
      "order_id": string;
      "status"?: string;
      "reason": string;
      "requested_by"?: string | null;
      "requested_at"?: string;
      "reviewed_by"?: string | null;
      "reviewed_at"?: string | null;
      "review_note"?: string | null;
      "already_collected"?: boolean;
      "return_status"?: string | null;
      "return_received_at"?: string | null;
      "return_received_by"?: string | null;
      "return_note"?: string | null;
    };
    Update: {
      "id"?: string;
      "order_id"?: string;
      "status"?: string;
      "reason"?: string;
      "requested_by"?: string | null;
      "requested_at"?: string;
      "reviewed_by"?: string | null;
      "reviewed_at"?: string | null;
      "review_note"?: string | null;
      "already_collected"?: boolean;
      "return_status"?: string | null;
      "return_received_at"?: string | null;
      "return_received_by"?: string | null;
      "return_note"?: string | null;
    };
  };
  "profiles": {
    Row: {
      "id": string;
      "email": string;
      "full_name": string | null;
      "role": DatabaseEnums["user_role"];
      "location_id": string | null;
      "created_at": string | null;
      "updated_at": string | null;
      "status": DatabaseEnums["profile_status"];
      "phone": string | null;
    };
    Insert: {
      "id": string;
      "email": string;
      "full_name"?: string | null;
      "role"?: DatabaseEnums["user_role"];
      "location_id"?: string | null;
      "created_at"?: string | null;
      "updated_at"?: string | null;
      "status"?: DatabaseEnums["profile_status"];
      "phone"?: string | null;
    };
    Update: {
      "id"?: string;
      "email"?: string;
      "full_name"?: string | null;
      "role"?: DatabaseEnums["user_role"];
      "location_id"?: string | null;
      "created_at"?: string | null;
      "updated_at"?: string | null;
      "status"?: DatabaseEnums["profile_status"];
      "phone"?: string | null;
    };
  };
  "weekly_invoice_publications": {
    Row: {
      "id": string;
      "weekly_invoice_id": string;
      "revision": number;
      "published_at": string;
      "published_by": string | null;
      "snapshot": Json;
    };
    Insert: {
      "id"?: string;
      "weekly_invoice_id": string;
      "revision": number;
      "published_at"?: string;
      "published_by"?: string | null;
      "snapshot": Json;
    };
    Update: {
      "id"?: string;
      "weekly_invoice_id"?: string;
      "revision"?: number;
      "published_at"?: string;
      "published_by"?: string | null;
      "snapshot"?: Json;
    };
  };
  "weekly_invoices": {
    Row: {
      "id": string;
      "location_id": string;
      "start_date": string;
      "end_date": string;
      "created_by": string | null;
      "created_at": string;
      "revision": number;
      "sent_revision": number | null;
      "sent_at": string | null;
      "sent_by": string | null;
      "needs_sending": boolean | null;
      "payment_status": string;
      "payment_updated_at": string | null;
      "payment_updated_by": string | null;
      "payment_updated_name": string | null;
      "payment_revision": number | null;
    };
    Insert: {
      "id"?: string;
      "location_id": string;
      "start_date": string;
      "end_date": string;
      "created_by"?: string | null;
      "created_at"?: string;
      "revision"?: number;
      "sent_revision"?: number | null;
      "sent_at"?: string | null;
      "sent_by"?: string | null;
      "needs_sending"?: never;
      "payment_status"?: string;
      "payment_updated_at"?: string | null;
      "payment_updated_by"?: string | null;
      "payment_updated_name"?: string | null;
      "payment_revision"?: number | null;
    };
    Update: {
      "id"?: string;
      "location_id"?: string;
      "start_date"?: string;
      "end_date"?: string;
      "created_by"?: string | null;
      "created_at"?: string;
      "revision"?: number;
      "sent_revision"?: number | null;
      "sent_at"?: string | null;
      "sent_by"?: string | null;
      "needs_sending"?: never;
      "payment_status"?: string;
      "payment_updated_at"?: string | null;
      "payment_updated_by"?: string | null;
      "payment_updated_name"?: string | null;
      "payment_revision"?: number | null;
    };
  };
};
