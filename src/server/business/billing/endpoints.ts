import "server-only";
import { businessEndpoint } from "../http";
import { GET } from "./pdf-handler";
export const viewInvoicePdf = businessEndpoint(GET);
