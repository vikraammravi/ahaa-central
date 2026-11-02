"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncData } from "@/lib/useAsyncData";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { FilterBar } from "@/components/shared/FilterBar";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { ReceiptReview } from "@/features/vendor-documents/components/ReceiptReview";
import { ReceiptList } from "@/features/vendor-documents/components/ReceiptList";
import { ReceiptUploadDialog } from "@/features/vendor-documents/components/ReceiptUploadDialog";
import { expenseCategories, type PurchaseReceipt, type ReceiptDetails } from "@/features/vendor-documents/domain";

import { receiptApi as api } from "../api";
export default function ReceiptsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const listUrl = useMemo(() => "/api/receipts?" + new URLSearchParams({ page: String(page), search: debouncedSearch, category, status }), [page, debouncedSearch, category, status]);
  const loadList = useCallback((signal: AbortSignal) => api(listUrl, { signal }) as Promise<{ rows: PurchaseReceipt[]; count: number }>, [listUrl]);
  const list = useAsyncData(loadList, { refreshOnFocus: false });
  const rows = list.data?.rows ?? [];
  const count = list.data?.count ?? 0;
  const loading = list.loading;
  const refresh = list.refresh;
  const pageError = error || list.error;
  const receiptId = receipt?.id;
  const scanStatus = receipt?.scan_status;
  useEffect(() => {
    if (!receiptId || scanStatus !== "RUNNING") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await api(`/api/receipts/${receiptId}`);
        if (cancelled) return;
        if (data.receipt.scan_status !== "RUNNING") { setReceipt(data.receipt); setRevision(r => r + 1); setNotice(data.receipt.scan_status === "SUCCEEDED" ? "Scan complete. Review the original before saving." : "Scan failed. You can retry or enter details manually."); return; }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to check scan."); }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [receiptId, scanStatus]);
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to complete action."); } finally { setBusy(false); } }
  async function upload(file: File, model: string) {
    const form = new FormData(); form.set("file", file); form.set("model", model);
    const data = await api("/api/receipts", { method: "POST", body: form });
    setError("");
    setNotice(data.restored ? "Previously deleted invoice restored. Scan usage is unchanged." : data.duplicate ? "This file already exists in the invoice list." : "Invoice uploaded as a draft. Open Edit to scan and review it.");
    if (page === 0 && !debouncedSearch && !category && !status) {
      if (!rows.some(row => row.id === data.receipt.id)) {
        list.mutate(current => ({ rows: [data.receipt, ...(current?.rows ?? [])].slice(0, 25), count: (current?.count ?? 0) + 1 }));
      }
    }
    if (page !== 0) setPage(0);
    else void refresh();
  }
  async function remove(row: PurchaseReceipt) {
    await api(`/api/receipts/${row.id}`, { method: "DELETE" });
    setNotice("Vendor invoice removed from the list.");
    if (rows.length === 1 && page > 0) setPage(page - 1); else await refresh();
  }
  async function save(details: ReceiptDetails, category: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/api/receipts/${receipt!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ details, category, reviewed: true }) });
      setReceipt(null);
      setNotice("Vendor invoice completed successfully. Inventory has not changed.");
      await refresh();
    } finally { setBusy(false); }
  }
  async function scan() {
    setError("");
    try { await api(`/api/receipts/${receipt!.id}`, { method: "POST" }); setReceipt(r => r ? { ...r, scan_status: "RUNNING" } : r); }
    catch (e) { throw e; }
  }
  return <div className="max-w-[1400px] mx-auto min-w-0 space-y-5">
    <PageHeader title="Vendor Invoices" subtitle="10 AI scans per user per day · 4 MB per file · 100 scans/month per environment." actions={!receipt && <ReceiptUploadDialog onUpload={upload} />} />
    {pageError && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{pageError}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}
    {receipt ? <ReceiptReview key={`${receipt.id}-${revision}`} receipt={receipt} busy={busy} onSave={save} onScan={scan} onClose={() => { setReceipt(null); void refresh(); }} /> : <>
      <FilterBar columns={3}>
        <FormField label="Search invoices" htmlFor="receipt-search"><Input id="receipt-search" type="search" placeholder="Vendor or invoice number" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></FormField>
        <FormField label="Category" htmlFor="receipt-category-filter"><FormSelect id="receipt-category-filter" value={category} onChange={value => { setCategory(value); setPage(0); }} options={[{ value: "", label: "All categories" }, ...expenseCategories.map(value => ({ value, label: value }))]} /></FormField>
        <FormField label="Status" htmlFor="receipt-status-filter"><FormSelect id="receipt-status-filter" value={status} onChange={value => { setStatus(value); setPage(0); }} options={[{ value: "", label: "All statuses" }, { value: "DRAFT", label: "Draft" }, { value: "SAVED", label: "Completed" }]} /></FormField>
      </FilterBar>
      <ReceiptList rows={rows} loading={loading} busy={busy || loading} onEdit={row => { void run(async () => { const data = await api(`/api/receipts/${row.id}`); setReceipt(data.receipt); setRevision(r => r + 1); }); }} onDelete={remove} />
      {(!loading || rows.length > 0) && <Pagination page={page} pageSize={25} count={count} busy={busy || loading} onChange={value => { setPage(value); }} />}
    </>}
  </div>;
}
