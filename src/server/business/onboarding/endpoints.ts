import "server-only";
import { businessEndpoint } from "../http";
import { acceptOwnerInvitation as accept } from "./accept-invitation";

export const acceptOwnerInvitation = businessEndpoint(accept);
