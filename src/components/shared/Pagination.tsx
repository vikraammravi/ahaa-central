import { Button } from "@/components/ui/button";

export function Pagination({ page, pageSize, count, busy, onChange }: {
  page: number; pageSize: number; count: number; busy?: boolean; onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
    <p className="text-muted-foreground">{count ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, count)} of ${count}` : "0 results"}</p>
    <div className="flex items-center gap-3"><Button variant="outline" disabled={busy || page === 0} onClick={() => onChange(page - 1)}>Previous</Button><span>Page {page + 1} of {pages}</span><Button variant="outline" disabled={busy || page + 1 >= pages} onClick={() => onChange(page + 1)}>Next</Button></div>
  </nav>;
}
