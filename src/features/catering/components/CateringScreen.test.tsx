import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CateringScreen } from "@/features/catering/components/CateringScreen";
import { savedDeliveryBooking } from "@tests/mocks/catering-screen";

const mock = vi.hoisted(() => ({ fetch: vi.fn(), complete: vi.fn(), user: vi.fn() }));
vi.mock("@/features/catering/data", () => ({
  fetchCatering: mock.fetch,
  completePastCatering: mock.complete,
  fetchCentralCateringLocation: vi.fn(),
  deleteCatering: vi.fn(),
}));
vi.mock("@/lib/useCurrentUser", () => ({ useCurrentUser: mock.user }));
vi.mock("@/features/catering/components/CateringEventDialog", () => ({
  CateringEventDialog: ({ onSaved }: { onSaved: (saved: typeof savedDeliveryBooking) => void }) =>
    <button onClick={() => onSaved(savedDeliveryBooking)}>Save test delivery</button>,
}));

beforeEach(() => {
  mock.user.mockReturnValue({ profile: { location_id: "test-branch", role: "BRANCH_MANAGER" }, loading: false, error: null });
  mock.complete.mockResolvedValue("test-branch");
  mock.fetch.mockResolvedValue({ rows: [], count: 0, page: 0 });
});

it.each(["BRANCH_MANAGER", "BRANCH_EMPLOYEE"])("clears the automatically selected date when %s chooses All statuses", async role => {
  mock.user.mockReturnValue({ profile: { location_id: "test-branch", role }, loading: false, error: null });
  render(<CateringScreen />);
  await waitFor(() => expect(mock.fetch).toHaveBeenCalled());
  await userEvent.click(screen.getByRole("button", { name: "Save test delivery" }));
  expect(screen.getByLabelText("Event Date")).toHaveValue("2030-06-15");
  await userEvent.selectOptions(screen.getByLabelText("Status"), "ALL");
  expect(screen.getByLabelText("Event Date")).toHaveValue("");
  await waitFor(() => expect(mock.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ALL", startDate: "", endDate: "", locationId: "test-branch" }), expect.any(AbortSignal)));
  expect(screen.queryByText(/Booking saved/)).not.toBeInTheDocument();
});

it("retains a date deliberately chosen by the user when selecting All statuses", async () => {
  render(<CateringScreen />);
  await waitFor(() => expect(mock.fetch).toHaveBeenCalled());
  await userEvent.click(screen.getByRole("button", { name: "Save test delivery" }));
  const date = screen.getByLabelText("Event Date");
  await userEvent.clear(date);
  await userEvent.type(date, "2029-05-03");
  await userEvent.selectOptions(screen.getByLabelText("Status"), "ALL");
  expect(date).toHaveValue("2029-05-03");
  await waitFor(() => expect(mock.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ALL", startDate: "2029-05-03", endDate: "2029-05-03" }), expect.any(AbortSignal)));
});

it.each(["PICKUP", "DELIVERY"])("applies the %s method without changing the chosen status or date", async method => {
  render(<CateringScreen />);
  await waitFor(() => expect(mock.fetch).toHaveBeenCalled());
  await userEvent.selectOptions(screen.getByLabelText("Status"), "ALL");
  await userEvent.type(screen.getByLabelText("Event Date"), "2029-05-03");
  await userEvent.selectOptions(screen.getByLabelText("Pickup / Delivery"), method);
  expect(screen.getByLabelText("Status")).toHaveValue("ALL");
  expect(screen.getByLabelText("Event Date")).toHaveValue("2029-05-03");
  await waitFor(() => expect(mock.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ALL", fulfillment: method, startDate: "2029-05-03", page: 0 }), expect.any(AbortSignal)));
});

it("clears search, status, date, method and pagination to default", async () => {
  mock.fetch.mockImplementation(async ({ page }: {page:number}) => ({ rows: [], count: 100, page }));
  render(<CateringScreen />);
  await waitFor(() => expect(mock.fetch).toHaveBeenCalled());
  await userEvent.selectOptions(screen.getByLabelText("Status"), "ALL");
  await userEvent.selectOptions(screen.getByLabelText("Pickup / Delivery"), "DELIVERY");
  await userEvent.type(screen.getByLabelText("Event Date"), "2029-05-03");
  await userEvent.type(screen.getByLabelText("Search customers"), "Nisha");
  await waitFor(() => expect(mock.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Nisha" }), expect.any(AbortSignal)));
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(mock.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.any(AbortSignal)));
  await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByLabelText("Search customers")).toHaveValue("");
  expect(screen.getByLabelText("Status")).toHaveValue("CONFIRMED");
  expect(screen.getByLabelText("Pickup / Delivery")).toHaveValue("ALL");
  expect(screen.getByLabelText("Event Date")).toHaveValue("");
  await waitFor(() => expect(mock.fetch).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, search: "", status: "CONFIRMED", fulfillment: "ALL", startDate: "", endDate: "" }), expect.any(AbortSignal)));
});
