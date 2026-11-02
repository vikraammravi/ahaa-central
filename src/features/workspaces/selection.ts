import { BUSINESS_COOKIE, validBusinessId } from "./context";

export function saveBusinessSelection(id: string | null) {
  if (id !== null && !validBusinessId(id)) throw new Error("Invalid workspace selection.");
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${BUSINESS_COOKIE}=${id ?? ""}; Path=/; SameSite=Lax${secure}${id === null ? "; Max-Age=0" : ""}`;
}
