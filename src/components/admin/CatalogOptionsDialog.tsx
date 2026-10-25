"use client";
import { useState } from "react";
import { Power, PowerOff, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RowActions } from "@/components/shared/RowActions";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import type { CatalogOption, CatalogOptionKind } from "@/lib/catalog-options";

export function CatalogOptionsDialog({ kind, options, loading, onSaved }: {
  kind: CatalogOptionKind; options: CatalogOption[]; loading: boolean; onSaved: () => Promise<unknown>;
}) {
  const title = kind === "categories" ? "Categories" : "Units";
  const table = kind === "categories" ? "catalog_categories" : "catalog_units";
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const archivedMatch = options.find(option => !option.is_active && option.name.toLowerCase() === name.trim().toLowerCase());
  const visibleOptions = options.filter(option => option.is_active || showArchived);
  async function mutate(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setError(null);
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message);
      setEditing(null); setName(""); await onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save."); }
    finally { setBusy(false); }
  }
  function validName(value: string, exceptId?: string) {
    if (!value.trim() || value.trim().length > 60) { setError("Enter a name of 1–60 characters."); return false; }
    if (options.some(option => option.id !== exceptId && option.name.toLowerCase() === value.trim().toLowerCase())) {
      setError("This name already exists."); return false;
    }
    return true;
  }
  return <Dialog onOpenChange={() => { setError(null); setEditing(null); setName(""); setShowArchived(false); }}>
    <DialogTrigger asChild><Button variant="outline" className="h-11 lg:h-9">Manage {title}</Button></DialogTrigger>
    <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-sm">
      <DialogHeader className="shrink-0 pr-6"><DialogTitle>Manage {title}</DialogTitle><DialogDescription>Archive options to hide them from new items while keeping existing records. Archived options can be restored. Only unused options can be deleted.</DialogDescription></DialogHeader>
      <form className="flex min-w-0 gap-2" onSubmit={event => { event.preventDefault(); if (!archivedMatch && validName(name)) void mutate(() => supabase.from(table).insert({ name: name.trim() })); }}>
        <Input aria-label={`New ${kind === "categories" ? "category" : "unit"}`} placeholder={`New ${kind === "categories" ? "category" : "unit"}`} value={name} onChange={event => { setName(event.target.value); setError(null); }} maxLength={60} className="min-w-0 h-11" disabled={busy}/>
        <Button type="submit" className="h-11 shrink-0" disabled={busy || loading || !!archivedMatch}><Plus className="size-4"/>Add</Button>
      </form>
      {archivedMatch && <div role="status" className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3">
        <p className="min-w-0 flex-1 break-words text-sm">“{archivedMatch.name}” already exists in archived {kind}. Restore it?</p>
        <Button type="button" variant="outline" className="h-11 shrink-0" disabled={busy || loading} onClick={() => void mutate(() => supabase.from(table).update({ is_active: true }).eq("id", archivedMatch.id))}>Restore</Button>
      </div>}
      {error && <Banner tone="danger">{error}</Banner>}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-saffron" checked={showArchived} disabled={busy} onChange={event => { setShowArchived(event.target.checked); setEditing(null); }}/>
        Show archived
      </label>
      <ul className="min-h-0 min-w-0 overflow-y-auto overscroll-contain scroll-smooth divide-y [scrollbar-width:thin] [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] motion-reduce:scroll-auto" aria-label={title}>
        {visibleOptions.map(option => <li key={option.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3">
          {editing === option.id ? <form className="flex w-full min-w-0 gap-1" onSubmit={event => { event.preventDefault(); if (validName(draft, option.id)) void mutate(() => supabase.from(table).update({ name: draft.trim() }).eq("id", option.id)); }}>
            <Input aria-label={`Rename ${option.name}`} autoFocus value={draft} onChange={event => setDraft(event.target.value)} maxLength={60} className="min-w-0 h-11" disabled={busy}/>
            <Button type="submit" size="icon" className="size-11 shrink-0" aria-label="Save name" disabled={busy}><Check className="size-4"/></Button>
            <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label="Cancel rename" disabled={busy} onClick={() => setEditing(null)}><X className="size-4"/></Button>
          </form> : <>
            <div className="min-w-0 flex-1"><p className="break-words font-medium">{option.name}</p><p className="text-xs text-muted-foreground">{option.is_active ? "Active" : "Archived"}{option.ever_used ? " · Used" : ""}</p></div>
            <fieldset disabled={busy} className="shrink-0"><RowActions onEdit={() => { setEditing(option.id); setDraft(option.name); setError(null); }} onDelete={option.ever_used ? undefined : async () => {
              const { error } = await supabase.from(table).delete().eq("id", option.id); if (error) throw new Error(error.message); await onSaved();
            }} deleteTitle={`Delete ${option.name}?`} deleteDescription="This unused option will be permanently removed." extraActions={<Button variant="outline" size="icon" className="size-11 lg:size-9" aria-label={`${option.is_active ? "Archive" : "Restore"} ${option.name}`} title={option.is_active ? "Archive" : "Restore"} onClick={() => void mutate(() => supabase.from(table).update({ is_active: !option.is_active }).eq("id", option.id))}>{option.is_active ? <PowerOff className="size-4"/> : <Power className="size-4"/>}</Button>}/></fieldset>
          </>}
        </li>)}
      </ul>
      {loading && <p role="status">Loading {kind}…</p>}
      {!loading && !visibleOptions.length && <p className="text-sm text-muted-foreground">{options.length ? `No active ${kind}. Show archived to restore an option, or add a new one above.` : `No ${kind} yet. Add one above.`}</p>}
    </DialogContent>
  </Dialog>;
}
