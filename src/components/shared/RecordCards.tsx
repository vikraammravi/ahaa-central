import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export const RECORD_CARD_GRID="grid min-w-0 gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]";

export function RecordCards<T>({data,loading,rowKey,children,emptyTitle,emptyBody}:{
  data:T[]|null;loading:boolean;rowKey:(row:T)=>string;
  children:(row:T)=>ReactNode;emptyTitle:string;emptyBody?:string;
}) {
  if(loading&&!data?.length)return <p role="status" className="py-6 text-center text-sm text-muted-foreground">Loading…</p>;
  if(!data?.length)return <div className="py-6 text-center"><p className="font-medium">{emptyTitle}</p>{emptyBody&&<p className="mt-1 text-sm text-muted-foreground">{emptyBody}</p>}</div>;
  return <div className={RECORD_CARD_GRID} aria-busy={loading}>{data.map(row=><Card size="sm" key={rowKey(row)} className="min-w-0"><CardContent className="min-w-0 space-y-3">{children(row)}</CardContent></Card>)}</div>;
}
