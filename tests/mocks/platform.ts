import type { OwnerInvitation, PlatformBusiness, PlatformDirectory } from "@/features/platform/data";

// Synthetic platform directory data. Far-future/past dates keep invitation state stable without fake timers.
export const platformBusinesses: PlatformBusiness[] = [
  { id: "a", name: "Ahaa", slug: "ahaa", status: "active", isolation_ready: false, owner_assigned: true, created_at: "2026-11-02T00:00:00Z", invitation: null },
  { id: "b", name: "Example Business", slug: "example-business", status: "provisioning", isolation_ready: false, owner_assigned: false, created_at: "2026-11-02T00:00:00Z", invitation: null },
];
export const ownerAssignedBusiness: PlatformBusiness = { ...platformBusinesses[1], owner_assigned: true };

const invitationBase: OwnerInvitation = { name: "Invited Admin", email: "invited@example.invalid", state: "issued", created_at: "2026-11-02T00:00:00Z", expires_at: "2099-01-01T00:00:00Z", completed_at: null };
export const pendingInvitation: OwnerInvitation = invitationBase;
export const expiredInvitation: OwnerInvitation = { ...invitationBase, expires_at: "2000-01-01T00:00:00Z" };
export const reviewInvitation: OwnerInvitation = { ...invitationBase, state: "processing" };
export const revokedInvitation: OwnerInvitation = { ...invitationBase, state: "revoked" };
export const acceptedInvitation: OwnerInvitation = { ...invitationBase, state: "completed", completed_at: "2026-11-03T00:00:00Z" };

export function businessWithInvitation(invitation: OwnerInvitation | null, overrides: Partial<PlatformBusiness> = {}): PlatformBusiness {
  return { ...platformBusinesses[1], invitation, ...overrides };
}
export function directory(businesses: PlatformBusiness[] = platformBusinesses, invitationsUnavailable = false): PlatformDirectory {
  return { businesses, invitationsUnavailable };
}

export const exampleInvitation = { invitationUrl: "https://app.example.invalid/accept-invite#token=synthetic-test-token", expiresAt: "2026-11-21T00:00:00Z" };
export const exampleInvitationToken = "synthetic-test-token";
