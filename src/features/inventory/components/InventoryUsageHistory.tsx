"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/shared/Banner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatDateTime, POLL_INTERVAL } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fetchUsageHistory, USAGE_HISTORY_PAGE_SIZE, type InventoryUsage } from "@/features/inventory/usage-history";

const columns: Column<InventoryUsage>[] = [
  { key: "date", header: "Inventory Date", render: row => formatDate(row.count_date) },
  { key: "item", header: "Item", cardSpan: 2, className: "whitespace-normal", render: row => row.item_name },
  { key: "unit", header: "Unit", render: row => row.unit_type },
  { key: "used", header: "Used", align: "right", render: row => row.used_quantity ?? "N/A" },
  { key: "by", header: "Updated By", className: "whitespace-normal", render: row => row.submitted_name },
  { key: "at", header: "Updated At", className: "whitespace-normal", render: row => formatDateTime(row.submitted_at) },
];

export function InventoryUsageHistory({ refreshToken = 0 }: { refreshToken?: number }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search);
  const invalidRange = !!fromDate && !!toDate && fromDate > toDate;
  const load = useCallback((signal: AbortSignal) => fetchUsageHistory({ fromDate, toDate, search: debouncedSearch, page }, signal), [fromDate, toDate, debouncedSearch, page]);
  const { data, loading, error, refresh } = useAsyncData(load, { enabled: !invalidRange, pollInterval: POLL_INTERVAL });
  const lastRefresh = useRef(refreshToken);
  useEffect(() => {
    if (lastRefresh.current !== refreshToken) {
      lastRefresh.current = refreshToken;
      void refresh();
    }
  }, [refreshToken, refresh]);

  return <section className="space-y-4" aria-label="Inventory usage history">
    <p className="text-sm text-muted-foreground">Daily usage from the latest saved inventory update for each date. Earlier updates remain in Update History. N/A means usage was not recorded.</p>
    <FilterBar columns={3}>
      <div className="min-w-0 space-y-1.5"><Label htmlFor="usage-search">Search Item</Label><Input id="usage-search" type="search" placeholder="Search item name" maxLength={200} value={search} className="h-11 lg:h-10" onChange={event => { setSearch(event.target.value); setPage(0); }} /></div>
      <div className="min-w-0 space-y-1.5"><Label htmlFor="usage-from">From Date</Label><Input id="usage-from" type="date" value={fromDate} max={toDate || undefined} className="h-11 lg:h-10 max-w-full" onChange={event => { setFromDate(event.target.value); setPage(0); }} /></div>
      <div className="min-w-0 space-y-1.5"><Label htmlFor="usage-to">To Date</Label><Input id="usage-to" type="date" value={toDate} min={fromDate || undefined} className="h-11 lg:h-10 max-w-full" onChange={event => { setToDate(event.target.value); setPage(0); }} /></div>
    </FilterBar>
    {invalidRange && <Banner tone="danger">From Date must be on or before To Date.</Banner>}
    {error && !invalidRange && <Banner tone="danger">{error}</Banner>}
    <DataTable data={invalidRange ? [] : data?.rows ?? null} columns={columns} loading={!invalidRange && loading} rowKey={row => row.id} emptyTitle={invalidRange ? "Choose a valid date range" : "No saved usage matches your filters"} emptyBody="Save a daily inventory count or change the item search and dates." />
    <Pagination page={invalidRange ? 0 : data?.page ?? page} pageSize={USAGE_HISTORY_PAGE_SIZE} count={invalidRange ? 0 : data?.total ?? 0} busy={loading || invalidRange} onChange={setPage} />
  </section>;
}
