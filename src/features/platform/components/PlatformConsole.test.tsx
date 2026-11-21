import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  acceptedInvitation, businessWithInvitation, directory, exampleInvitation, expiredInvitation, ownerAssignedBusiness,
  pendingInvitation, platformBusinesses, reviewInvitation, revokedInvitation,
} from "@tests/mocks/platform";
import { activateBusiness, assignBusinessOwner, fetchBusinesses, inviteBusinessOwner, registerBusiness, resolveBusinessInvitation, revokeBusinessInvitation, type PlatformBusiness } from "../data";
import PlatformConsole from "./PlatformConsole";

vi.mock("../data", async importOriginal => {
  const actual = await importOriginal<typeof import("../data")>();
  return { ...actual, fetchBusinesses: vi.fn(), registerBusiness: vi.fn(), assignBusinessOwner: vi.fn(), inviteBusinessOwner: vi.fn(), activateBusiness: vi.fn(), revokeBusinessInvitation: vi.fn(), resolveBusinessInvitation: vi.fn() };
});
vi.mock("@/components/shared/SignOutButton", () => ({ SignOutButton: () => <button>Sign out</button> }));

const allFlags = { registrationEnabled: true, ownerAssignmentEnabled: true, invitationsEnabled: true, activationEnabled: true };
beforeEach(() => {
  vi.mocked(fetchBusinesses).mockResolvedValue(directory());
  vi.mocked(registerBusiness).mockResolvedValue();
  vi.mocked(assignBusinessOwner).mockResolvedValue();
  vi.mocked(inviteBusinessOwner).mockResolvedValue(exampleInvitation);
  vi.mocked(activateBusiness).mockResolvedValue();
  vi.mocked(revokeBusinessInvitation).mockResolvedValue();
  vi.mocked(resolveBusinessInvitation).mockResolvedValue("revoked");
});
const showing = (...businesses: PlatformBusiness[]) => vi.mocked(fetchBusinesses).mockResolvedValue(directory(businesses));
const row = async (name = "Example Business") => (await screen.findByRole("heading", { name })).closest("li")!;
function renderDirectory(ui: ReactElement) {
  const result = render(ui);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Platform navigation" })).getByRole("button", { name: /^Businesses/ }));
  return result;
}
// Radix registers its outside-pointer listener after a tick; the overlay is the outside target.
async function clickOutside() {
  await new Promise(resolve => setTimeout(resolve, 0));
  const overlay = document.querySelector("[data-slot='dialog-overlay']") ?? document.body;
  fireEvent.pointerDown(overlay, { button: 0, pointerType: "mouse" });
  fireEvent.pointerUp(overlay, { button: 0, pointerType: "mouse" });
  fireEvent.click(overlay);
}
function overviewCount(label: string) {
  const region = screen.getByRole("region", { name: "Business overview" });
  return within(region).getByText(label).nextElementSibling?.textContent;
}

const nav = () => screen.getByRole("navigation", { name: "Platform navigation" });
const navButton = (name: string) => within(nav()).getByRole("button", { name: new RegExp(`^${name}`) });
const panel = (name: string) => screen.getByRole("region", { name });

it("opens on the platform-branded overview with registration unavailable by default", async () => {
  render(<PlatformConsole />);
  expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  expect(screen.getAllByText("Kitchen Ops Cloud").length).toBeGreaterThan(0);
  const sidebar = screen.getByRole("complementary");
  expect(within(sidebar).getByText("Kitchen Ops Cloud")).toBeInTheDocument();
  expect(sidebar.textContent).not.toMatch(/Ahaa|Aaha/);
  expect(navButton("Overview")).toHaveAttribute("aria-current", "page");
  expect(navButton("Businesses")).not.toHaveAttribute("aria-current");
  expect(within(nav()).queryAllByRole("link")).toHaveLength(0);
  expect(await screen.findByRole("region", { name: "Business overview" })).toBeInTheDocument();
  expect(screen.getByText("Business registration is not enabled in this environment. You can review the business directory.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add business" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  // Per-business actions live in the directory, not the overview.
  expect(screen.queryByRole("button", { name: /first admin/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /invoice/i })).not.toBeInTheDocument();
});

it("counts businesses, setup, awaiting admin and pending invites on the overview", async () => {
  showing(
    platformBusinesses[0],
    platformBusinesses[1],
    { ...ownerAssignedBusiness, id: "c", name: "Assigned Business" },
    { ...platformBusinesses[1], id: "d", name: "Suspended", status: "suspended" },
    businessWithInvitation(pendingInvitation, { id: "e", name: "Pending Business" }),
    businessWithInvitation(expiredInvitation, { id: "f", name: "Expired Business" }),
  );
  render(<PlatformConsole />);
  await within(await screen.findByRole("region", { name: "Recently added" })).findByText("Assigned Business");
  expect(overviewCount("Businesses")).toBe("6");
  expect(overviewCount("Active")).toBe("1");
  expect(overviewCount("In setup")).toBe("4");
  expect(overviewCount("Awaiting admin")).toBe("3");
  expect(overviewCount("Pending invites")).toBe("1");
});

it("does not count pending invites while invitation status is unavailable", async () => {
  vi.mocked(fetchBusinesses).mockResolvedValue(directory([businessWithInvitation(pendingInvitation)], true));
  render(<PlatformConsole {...allFlags} />);
  await screen.findByRole("region", { name: "Business overview" });
  expect(overviewCount("Pending invites")).toBe("0");
});

it("lists needs-attention items most urgent first with the matching short action", async () => {
  showing(
    businessWithInvitation(null, { id: "n", name: "No Admin Co" }),
    businessWithInvitation(expiredInvitation, { id: "x", name: "Expired Co" }),
    businessWithInvitation({ ...pendingInvitation, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }, { id: "s", name: "Soon Co" }),
    { ...ownerAssignedBusiness, id: "r", name: "Ready Co" },
    businessWithInvitation(reviewInvitation, { id: "i", name: "Interrupted Co" }),
    businessWithInvitation(pendingInvitation, { id: "p", name: "Pending Co" }),
    platformBusinesses[0],
  );
  render(<PlatformConsole {...allFlags} />);
  const attention = await screen.findByRole("region", { name: "Needs attention" });
  await within(attention).findByText("Ready Co");
  const items = within(attention).getAllByRole("listitem");
  expect(items.map(item => item.querySelector("p")?.textContent)).toEqual(["Interrupted Co", "Ready Co", "Expired Co", "Soon Co", "No Admin Co"]);
  expect(items.map(item => within(item).getByRole("button").textContent)).toEqual(["Resolve", "Activate", "Invite", "Reissue", "Invite"]);
  expect(within(items[3]).getByText("Invitation expires within 6 hours")).toBeInTheDocument();
  expect(navButton("Businesses")).toHaveTextContent("Businesses5");
});

it.each([
  ["Resolve", "i", reviewInvitation, "Resolve interrupted setup"],
  ["Reissue", "s", { ...pendingInvitation, expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }, "Reissue invitation"],
  ["Invite", "n", null, "Set up first admin"],
] as const)("opens the %s flow from Needs attention", async (action, id, invitation, dialogName) => {
  showing(businessWithInvitation(invitation, { id, name: "Attention Co" }));
  render(<PlatformConsole {...allFlags} />);
  const attention = await screen.findByRole("region", { name: "Needs attention" });
  fireEvent.click(await within(attention).findByRole("button", { name: action }));
  expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
  if (action === "Reissue") expect(screen.getByLabelText("Admin email")).toHaveValue(pendingInvitation.email);
});

it("activates from Needs attention through the confirmation dialog", async () => {
  showing(ownerAssignedBusiness);
  render(<PlatformConsole {...allFlags} />);
  fireEvent.click(await within(await screen.findByRole("region", { name: "Needs attention" })).findByRole("button", { name: "Activate" }));
  const dialog = screen.getByRole("dialog", { name: "Activate business" });
  expect(activateBusiness).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Activate" }));
  await waitFor(() => expect(activateBusiness).toHaveBeenCalledWith(ownerAssignedBusiness.id));
  expect(await screen.findByText(/Example Business is active/)).toBeInTheDocument();
});

it("offers Assign instead of Invite when only assignment is enabled, and no action when setup is disabled", async () => {
  showing(businessWithInvitation(null, { id: "n", name: "No Admin Co" }));
  const { unmount } = render(<PlatformConsole registrationEnabled ownerAssignmentEnabled />);
  const attention = await screen.findByRole("region", { name: "Needs attention" });
  expect(await within(attention).findByRole("button", { name: "Assign" })).toBeInTheDocument();
  unmount();
  render(<PlatformConsole />);
  const readOnly = await screen.findByRole("region", { name: "Needs attention" });
  await within(readOnly).findByText("No Admin Co");
  expect(within(readOnly).queryByRole("button")).not.toBeInTheDocument();
});

it("shows only ready items in Needs attention while invitation status is unavailable", async () => {
  vi.mocked(fetchBusinesses).mockResolvedValue(directory([businessWithInvitation(reviewInvitation, { id: "i", name: "Interrupted Co" }), { ...ownerAssignedBusiness, id: "r", name: "Ready Co" }], true));
  render(<PlatformConsole {...allFlags} />);
  const attention = await screen.findByRole("region", { name: "Needs attention" });
  await within(attention).findByText("Ready Co");
  expect(within(attention).queryByText("Interrupted Co")).not.toBeInTheDocument();
  expect(within(attention).queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
});

it("shows All caught up when nothing needs a platform action", async () => {
  showing(platformBusinesses[0], businessWithInvitation(pendingInvitation));
  render(<PlatformConsole {...allFlags} />);
  expect(await within(await screen.findByRole("region", { name: "Needs attention" })).findByText("All caught up")).toBeInTheDocument();
  expect(navButton("Businesses")).toHaveTextContent(/^Businesses$/);
});

it("lists recently added businesses newest first and links to the full directory", async () => {
  const dated = ["2026-01-01", "2026-06-01", "2026-03-01", "2026-02-01", "2026-05-01", "2026-04-01"].map((day, index) => ({ ...platformBusinesses[1], id: `b${index}`, name: `Business ${index}`, slug: `business-${index}`, created_at: `${day}T00:00:00Z` }));
  showing(...dated);
  render(<PlatformConsole />);
  const recent = await screen.findByRole("region", { name: "Recently added" });
  await within(recent).findByText("Business 1");
  expect(within(recent).getAllByRole("listitem").map(item => item.querySelector("p")?.textContent)).toEqual(["Business 1", "Business 4", "Business 5", "Business 2", "Business 3"]);
  expect(within(recent).getByText("/business-1")).toBeInTheDocument();
  expect(within(recent).getAllByText("In setup")).toHaveLength(5);
  fireEvent.click(within(recent).getByRole("button", { name: "View all" }));
  expect(screen.getByRole("heading", { level: 1, name: "Businesses" })).toBeInTheDocument();
  expect(navButton("Businesses")).toHaveAttribute("aria-current", "page");
  expect(panel("Business directory")).toBeInTheDocument();
  fireEvent.click(navButton("Overview"));
  expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Business directory" })).not.toBeInTheDocument();
});

it("shows an empty overview with a first-business action when registration is enabled", async () => {
  showing();
  render(<PlatformConsole registrationEnabled />);
  const recent = await screen.findByRole("region", { name: "Recently added" });
  expect(await within(recent).findByText("No businesses registered yet.")).toBeInTheDocument();
  fireEvent.click(within(recent).getByRole("button", { name: "Add your first business" }));
  expect(screen.getByLabelText("Business name")).toBeInTheDocument();
});

it("searches the directory by name or address and filters by status", async () => {
  showing(
    platformBusinesses[0],
    businessWithInvitation(null, { id: "n", name: "Northwind Kitchen", slug: "northwind" }),
    businessWithInvitation(pendingInvitation, { id: "p", name: "Pending Co", slug: "harbor-cafe" }),
  );
  renderDirectory(<PlatformConsole {...allFlags} />);
  const directoryPanel = await screen.findByRole("region", { name: "Business directory" });
  await within(directoryPanel).findByText("Northwind Kitchen");
  const names = () => within(directoryPanel).queryAllByRole("heading", { level: 3 }).map(heading => heading.textContent);
  const filters = within(directoryPanel).getByRole("group", { name: "Filter businesses" });
  expect(within(filters).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  expect(names()).toEqual(["Ahaa", "Northwind Kitchen", "Pending Co"]);
  expect(within(directoryPanel).getByText("3 of 3 businesses")).toBeInTheDocument();
  const search = within(directoryPanel).getByRole("textbox", { name: "Search businesses" });
  fireEvent.change(search, { target: { value: "  NORTH " } });
  expect(names()).toEqual(["Northwind Kitchen"]);
  fireEvent.change(search, { target: { value: "harbor" } });
  expect(names()).toEqual(["Pending Co"]);
  expect(within(directoryPanel).getByText("1 of 3 businesses")).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "" } });
  fireEvent.click(within(filters).getByRole("button", { name: "Active" }));
  expect(within(filters).getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
  expect(within(filters).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
  expect(names()).toEqual(["Ahaa"]);
  fireEvent.click(within(filters).getByRole("button", { name: "In setup" }));
  expect(names()).toEqual(["Northwind Kitchen", "Pending Co"]);
  fireEvent.click(within(filters).getByRole("button", { name: "Needs attention" }));
  expect(names()).toEqual(["Northwind Kitchen"]);
  fireEvent.change(search, { target: { value: "pending" } });
  expect(names()).toEqual([]);
  expect(within(directoryPanel).getByText("No businesses match these filters.")).toBeInTheDocument();
});

it("shows directory rows as list items with status pills and slugs", async () => {
  renderDirectory(<PlatformConsole {...allFlags} />);
  const directoryPanel = await screen.findByRole("region", { name: "Business directory" });
  const exampleRow = await row();
  expect(exampleRow.parentElement?.tagName).toBe("UL");
  expect(within(exampleRow).getByText("/example-business")).toBeInTheDocument();
  expect(within(exampleRow).getByText("In setup")).toBeInTheDocument();
  expect(within(within(exampleRow).getByRole("list", { name: "Setup progress for Example Business" })).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Done: Registered", "To do: Admin ready", "To do: Activated"]);
  expect(within(await row("Ahaa")).getByText("Active")).toBeInTheDocument();
  expect(within(directoryPanel).getAllByRole("listitem").filter(item => item.parentElement?.parentElement === directoryPanel)).toHaveLength(2);
});

it("invites a new admin by default and shows the one-time link once", async () => {
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Invite first admin" }));
  const dialog = screen.getByRole("dialog", { name: "Set up first admin" });
  expect(within(dialog).getByRole("button", { name: "Invite new admin" })).toHaveAttribute("aria-pressed", "true");
  expect(within(dialog).queryByLabelText(/password/i)).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Admin name"), { target: { value: "Customer Admin" } });
  fireEvent.change(within(dialog).getByLabelText("Admin email"), { target: { value: "owner@example.invalid" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create invitation" }));
  await waitFor(() => expect(inviteBusinessOwner).toHaveBeenCalledWith("b", "Customer Admin", "owner@example.invalid"));
  expect(await within(dialog).findByLabelText("Invitation link")).toHaveValue(exampleInvitation.invitationUrl);
  expect(within(dialog).getByText(/won’t be shown again/)).toBeInTheDocument();
  expect(within(dialog).queryByText(/earlier link/)).not.toBeInTheDocument();
  expect(fetchBusinesses).toHaveBeenCalledTimes(1);
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  expect(await screen.findByText(/Invitation created. The business stays in setup/)).toBeInTheDocument();
  await waitFor(() => expect(fetchBusinesses).toHaveBeenCalledTimes(2));
  // Reopening the dialog starts fresh: the link is not shown again.
  fireEvent.click(screen.getByRole("button", { name: "Invite first admin" }));
  expect(screen.queryByLabelText("Invitation link")).not.toBeInTheDocument();
});

it("explains an existing account and keeps the form for switching to Existing account", async () => {
  vi.mocked(inviteBusinessOwner).mockRejectedValue(new Error("An account with this email already exists. Use Existing account instead."));
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Invite first admin" }));
  fireEvent.change(screen.getByLabelText("Admin name"), { target: { value: "Customer Admin" } });
  fireEvent.change(screen.getByLabelText("Admin email"), { target: { value: "owner@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
  expect(await screen.findByText("An account with this email already exists. Use Existing account instead.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Invitation link")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Admin email")).toHaveValue("owner@example.invalid");
});

it("assigns an existing account as the first admin", async () => {
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Invite first admin" }));
  fireEvent.click(screen.getByRole("button", { name: "Existing account" }));
  expect(screen.getByRole("button", { name: "Existing account" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByLabelText("Admin name")).not.toBeInTheDocument();
  expect(screen.getByText("The account must already exist and be active.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Admin email"), { target: { value: "owner@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Assign admin" }));
  await waitFor(() => expect(assignBusinessOwner).toHaveBeenCalledWith("b", "owner@example.invalid"));
  expect(inviteBusinessOwner).not.toHaveBeenCalled();
  expect(await screen.findByText(/Admin assigned. The business remains in setup/)).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(fetchBusinesses).toHaveBeenCalledTimes(2));
});

it("offers only existing-account assignment when invitations are disabled", async () => {
  renderDirectory(<PlatformConsole registrationEnabled ownerAssignmentEnabled />);
  fireEvent.click(await screen.findByRole("button", { name: "Assign first admin" }));
  expect(screen.queryByRole("group", { name: "Admin setup method" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Admin name")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Assign admin" })).toBeInTheDocument();
});

it("offers only invitations when assignment is disabled", async () => {
  renderDirectory(<PlatformConsole registrationEnabled invitationsEnabled />);
  fireEvent.click(await screen.findByRole("button", { name: "Invite first admin" }));
  expect(screen.queryByRole("group", { name: "Admin setup method" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Admin name")).toBeInTheDocument();
});

it("hides admin setup when invitations are enabled without registration", async () => {
  renderDirectory(<PlatformConsole invitationsEnabled ownerAssignmentEnabled />);
  await screen.findByText("Example Business");
  expect(screen.queryByRole("button", { name: /first admin/ })).not.toBeInTheDocument();
});

it("shows a pending invitation and reissues it pre-filled without a mode toggle", async () => {
  showing(businessWithInvitation(pendingInvitation));
  renderDirectory(<PlatformConsole {...allFlags} />);
  expect(within(await row()).getByText(/Invited invited@example.invalid · expires/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Invite first admin" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reissue link" }));
  const dialog = screen.getByRole("dialog", { name: "Reissue invitation" });
  expect(within(dialog).queryByRole("group", { name: "Admin setup method" })).not.toBeInTheDocument();
  expect(within(dialog).getByLabelText("Admin name")).toHaveValue(pendingInvitation.name);
  expect(within(dialog).getByLabelText("Admin email")).toHaveValue(pendingInvitation.email);
  fireEvent.click(within(dialog).getByRole("button", { name: "Create invitation" }));
  await waitFor(() => expect(inviteBusinessOwner).toHaveBeenCalledWith("b", pendingInvitation.name, pendingInvitation.email));
  expect(await within(dialog).findByText(/Any earlier link no longer works/)).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Invitation link")).toHaveValue(exampleInvitation.invitationUrl);
});

it("confirms revocation before calling the API, then refreshes", async () => {
  showing(businessWithInvitation(pendingInvitation));
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
  const dialog = screen.getByRole("dialog", { name: "Revoke invitation" });
  expect(within(dialog).getByText(/invited@example.invalid will stop working/)).toBeInTheDocument();
  expect(revokeBusinessInvitation).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
  await waitFor(() => expect(revokeBusinessInvitation).toHaveBeenCalledWith("b"));
  expect(await screen.findByText("The invitation for Example Business no longer works.")).toBeInTheDocument();
  await waitFor(() => expect(fetchBusinesses).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("does not revoke when cancelled and keeps the dialog open with the reason on failure", async () => {
  showing(businessWithInvitation(pendingInvitation));
  vi.mocked(revokeBusinessInvitation).mockRejectedValue(new Error("There is no unused invitation to revoke."));
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(revokeBusinessInvitation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Revoke" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("There is no unused invitation to revoke.");
  expect(screen.getByRole("dialog", { name: "Revoke invitation" })).toBeInTheDocument();
});

it("offers only resolution while a redemption was interrupted", async () => {
  showing(businessWithInvitation(reviewInvitation));
  renderDirectory(<PlatformConsole {...allFlags} />);
  expect(within(await row()).getByText("Setup by invited@example.invalid was interrupted. Resolve it to continue.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resolve interrupted setup" })).toBeInTheDocument();
  for (const name of ["Invite first admin", "Assign first admin", "Reissue link", "Revoke", "Activate business"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  }
});

it.each([
  ["completed", "The admin account for Example Business was finished. Review it, then activate the business."],
  ["revoked", "The interrupted invitation for Example Business was cancelled. Issue a new link to continue."],
] as const)("confirms resolution before calling the API and explains the %s outcome", async (outcome, notice) => {
  showing(businessWithInvitation(reviewInvitation));
  vi.mocked(resolveBusinessInvitation).mockResolvedValue(outcome);
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Resolve interrupted setup" }));
  const dialog = screen.getByRole("dialog", { name: "Resolve interrupted setup" });
  expect(within(dialog).getByText(/invited@example.invalid already created their login/)).toBeInTheDocument();
  expect(resolveBusinessInvitation).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" }));
  await waitFor(() => expect(resolveBusinessInvitation).toHaveBeenCalledWith("b"));
  expect(await screen.findByText(notice)).toBeInTheDocument();
  await waitFor(() => expect(fetchBusinesses).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("keeps the resolve dialog open with the reason when resolution fails, and does nothing on cancel", async () => {
  showing(businessWithInvitation(reviewInvitation));
  vi.mocked(resolveBusinessInvitation).mockRejectedValue(new Error("There is no interrupted invitation to resolve."));
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Resolve interrupted setup" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(resolveBusinessInvitation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Resolve interrupted setup" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Resolve" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("There is no interrupted invitation to resolve.");
  expect(screen.getByRole("dialog", { name: "Resolve interrupted setup" })).toBeInTheDocument();
  expect(fetchBusinesses).toHaveBeenCalledTimes(1);
});

it.each([
  ["invitations are disabled", { registrationEnabled: true, ownerAssignmentEnabled: true }, false],
  ["invitation status is unavailable", allFlags, true],
])("does not offer resolution when %s", async (_label, flags, unavailable) => {
  vi.mocked(fetchBusinesses).mockResolvedValue(directory([businessWithInvitation(reviewInvitation)], unavailable));
  renderDirectory(<PlatformConsole {...flags} />);
  await row();
  expect(screen.queryByRole("button", { name: "Resolve interrupted setup" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /first admin/ })).not.toBeInTheDocument();
});

it("does not offer resolution once the business has an admin", async () => {
  showing({ ...ownerAssignedBusiness, invitation: reviewInvitation });
  renderDirectory(<PlatformConsole {...allFlags} />);
  await row();
  expect(screen.queryByRole("button", { name: "Resolve interrupted setup" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Activate business" })).toBeInTheDocument();
});

it("keeps a shown invitation link open until Done is pressed", async () => {
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Invite first admin" }));
  const dialog = screen.getByRole("dialog", { name: "Set up first admin" });
  expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Admin name"), { target: { value: "Customer Admin" } });
  fireEvent.change(within(dialog).getByLabelText("Admin email"), { target: { value: "owner@example.invalid" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Create invitation" }));
  expect(await within(dialog).findByLabelText("Invitation link")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await clickOutside();
  expect(screen.getByRole("dialog", { name: "Set up first admin" })).toBeInTheDocument();
  expect(screen.getByLabelText("Invitation link")).toHaveValue(exampleInvitation.invitationUrl);
  expect(screen.queryByText(/Invitation created/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await screen.findByText(/Invitation created/)).toBeInTheDocument();
});

it("still closes with Escape before an invitation link is shown", async () => {
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Invite first admin" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(inviteBusinessOwner).not.toHaveBeenCalled();
  expect(screen.queryByText(/Invitation created/)).not.toBeInTheDocument();
  // Control for the outside-click check above: the same events close the form view.
  fireEvent.click(screen.getByRole("button", { name: "Invite first admin" }));
  await clickOutside();
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it.each([
  ["expired", expiredInvitation, /Invitation to invited@example.invalid expired/],
  ["revoked", revokedInvitation, /Invitation revoked/],
])("allows a fresh invitation after the previous one %s", async (_label, invitation, text) => {
  showing(businessWithInvitation(invitation));
  renderDirectory(<PlatformConsole {...allFlags} />);
  expect(within(await row()).getByText(text)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Invite first admin" }));
  expect(screen.getByRole("dialog", { name: "Set up first admin" })).toBeInTheDocument();
  expect(screen.getByLabelText("Admin email")).toHaveValue("");
});

it("pauses admin setup while invitation status is unavailable, without blocking other cards", async () => {
  const assigned = { ...ownerAssignedBusiness, id: "c", name: "Assigned Business" };
  vi.mocked(fetchBusinesses).mockResolvedValue(directory([platformBusinesses[0], platformBusinesses[1], assigned], true));
  renderDirectory(<PlatformConsole {...allFlags} />);
  expect(await screen.findByText("Invitation status is temporarily unavailable, so admin setup is paused to avoid replacing a link already shared. Refresh to try again.")).toBeInTheDocument();
  expect(within(await row()).getByText("Invitation status unavailable")).toBeInTheDocument();
  expect(within(await row()).queryByText("No admin yet")).not.toBeInTheDocument();
  for (const name of ["Invite first admin", "Assign first admin", "Reissue link", "Revoke"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  }
  expect(within(await row("Assigned Business")).getByText("Admin assigned")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Activate business" })).toHaveLength(1);
  expect(screen.getByText("Existing access")).toBeInTheDocument();
});

it("resumes admin setup once invitation status loads again", async () => {
  vi.mocked(fetchBusinesses).mockResolvedValueOnce(directory(platformBusinesses, true)).mockResolvedValue(directory(platformBusinesses));
  renderDirectory(<PlatformConsole {...allFlags} />);
  expect(await screen.findByText("Invitation status unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Invite first admin" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByRole("button", { name: "Invite first admin" })).toBeInTheDocument();
  expect(screen.queryByText(/admin setup is paused/)).not.toBeInTheDocument();
  expect(screen.getByText("No admin yet")).toBeInTheDocument();
});

it("pauses assignment-only setup too while invitation status is unavailable", async () => {
  vi.mocked(fetchBusinesses).mockResolvedValue(directory(platformBusinesses, true));
  renderDirectory(<PlatformConsole registrationEnabled ownerAssignmentEnabled />);
  expect(await screen.findByText("Invitation status unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Assign first admin" })).not.toBeInTheDocument();
});

it("confirms activation only for a setup business with an assigned admin, then refreshes", async () => {
  showing({ ...ownerAssignedBusiness, invitation: acceptedInvitation });
  renderDirectory(<PlatformConsole {...allFlags} />);
  expect(within(await row()).getByText("Admin accepted invitation")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /first admin/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Activate business" }));
  expect(activateBusiness).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Activate" }));
  await waitFor(() => expect(activateBusiness).toHaveBeenCalledWith(ownerAssignedBusiness.id));
  expect(await screen.findByText(/Example Business is active. Its admin can now sign in/)).toBeInTheDocument();
  await waitFor(() => expect(fetchBusinesses).toHaveBeenCalledTimes(2));
});

it("keeps the activation dialog open and explains failures", async () => {
  showing(ownerAssignedBusiness);
  vi.mocked(activateBusiness).mockRejectedValue(new Error("This business is not ready for activation."));
  renderDirectory(<PlatformConsole {...allFlags} />);
  fireEvent.click(await screen.findByRole("button", { name: "Activate business" }));
  fireEvent.click(screen.getByRole("button", { name: "Activate" }));
  expect(await screen.findByText("This business is not ready for activation.")).toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Activate business" })).toBeInTheDocument();
});

it("does not offer activation without an admin or when activation is disabled", async () => {
  showing(platformBusinesses[1], { ...ownerAssignedBusiness, id: "c", name: "Assigned Business" });
  const { unmount } = renderDirectory(<PlatformConsole {...allFlags} />);
  await screen.findByText("Assigned Business");
  expect(screen.getAllByRole("button", { name: "Activate business" })).toHaveLength(1);
  unmount();
  renderDirectory(<PlatformConsole {...allFlags} activationEnabled={false} />);
  await screen.findByText("Assigned Business");
  expect(screen.queryByRole("button", { name: "Activate business" })).not.toBeInTheDocument();
});

it("links an active isolated business to its sign-in page on the business app", async () => {
  showing({ ...platformBusinesses[0], isolation_ready: true, slug: "new-customer" });
  renderDirectory(<PlatformConsole {...allFlags} businessAppOrigin="https://business.example" />);
  expect(await screen.findByRole("link", { name: "Open business sign-in" })).toHaveAttribute("href", "https://business.example/b/new-customer");
  expect(screen.getByRole("link", { name: "Business app" })).toHaveAttribute("href", "https://business.example/workspaces");
});

it("registers a business in a dialog and explains the next setup steps", async () => {
  render(<PlatformConsole registrationEnabled />);
  expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add business" }));
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "New Customer" } });
  fireEvent.change(screen.getByLabelText("Business address"), { target: { value: "new-customer" } });
  fireEvent.click(screen.getByRole("button", { name: "Register business" }));
  await waitFor(() => expect(registerBusiness).toHaveBeenCalledWith("New Customer", "new-customer"));
  expect(await screen.findByText("Business registered. Invite its first admin, then activate it.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Businesses" })).toBeInTheDocument();
  expect(navButton("Businesses")).toHaveAttribute("aria-current", "page");
  await waitFor(() => expect(fetchBusinesses).toHaveBeenCalledTimes(2));
});

it("keeps entered details available when registration fails", async () => {
  vi.mocked(registerBusiness).mockRejectedValue(new Error("That business address is already in use."));
  renderDirectory(<PlatformConsole registrationEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "Add business" }));
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Ahaa" } });
  fireEvent.change(screen.getByLabelText("Business address"), { target: { value: "ahaa" } });
  fireEvent.click(screen.getByRole("button", { name: "Register business" }));
  expect(await screen.findByText("That business address is already in use.")).toBeInTheDocument();
  expect(screen.getByLabelText("Business name")).toHaveValue("Ahaa");
});

it("shows platform navigation while admin setup remains independently disabled", async () => {
  renderDirectory(<PlatformConsole registrationEnabled />);
  expect(await screen.findByRole("navigation", { name: "Platform navigation" })).toBeInTheDocument();
  expect(navButton("Businesses")).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { level: 1, name: "Businesses" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add business" })).toBeInTheDocument();
  await screen.findByText("Example Business");
  expect(screen.queryByRole("button", { name: /first admin/ })).not.toBeInTheDocument();
});
