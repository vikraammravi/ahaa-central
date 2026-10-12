import type { CateringStatus } from "./supabase/types";
import type { StatusKind } from "@/components/ui/status-badge";

export const CATERING_STATUS_LABEL: Record<CateringStatus, string> = {
  INQUIRY: "Inquiry",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const CATERING_STATUS_BADGE: Record<CateringStatus, StatusKind> = {
  INQUIRY: "pending",
  CONFIRMED: "in-stock",
  COMPLETED: "completed",
  CANCELLED: "error",
};

export const CATERING_STATUSES: CateringStatus[] = [
  "INQUIRY",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

export function phoneHref(phone: string): string | null {
  const number = phone.trim();
  const digits = number.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${number.startsWith("+") ? "+" : ""}${digits}`;
}

export function localDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function whatsappHref(phone:string):string|null {
 const value=phone.trim();if(!/^[+\d\s().-]+$/.test(value))return null;let digits=value.replace(/\D/g, "");
 if(value.startsWith("+")){if(digits.length<8||digits.length>15||digits.startsWith("0"))return null;}
 else if(value.startsWith("00")){digits=digits.slice(2);if(digits.length<8||digits.length>15||digits.startsWith("0"))return null;}
 else if(digits.length===10)digits="1"+digits;
 else if(digits.length!==11||!digits.startsWith("1"))return null;
 return `https://wa.me/${digits}`;
}
