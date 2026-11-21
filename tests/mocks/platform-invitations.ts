export const invitationBusinessId = "66c20b9b-b949-4ee4-9a29-9e1ac6aa4ea1";
export const invitationId = "3f8441bb-4534-4f70-b6fa-184e51e908e3";
export const invitationUserId = "56a47a6e-bf67-4ebe-aed7-dabf24c15f64";
export const exampleToken = "A".repeat(43);
export const examplePassword = "a-long-unique-test-password";
export const exampleAdmin = { name: "Test owner", email: "owner@example.invalid" };
export const exampleSummaryRow = { business_id: invitationBusinessId, ...exampleAdmin, state: "issued", created_at: "2026-11-20T00:00:00Z", expires_at: "2026-11-21T00:00:00Z", completed_at: null, token_hash: "never-returned" };
