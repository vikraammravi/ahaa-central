"use client";
import { useCallback } from "react";
import Link from "next/link";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchInventory } from "@/lib/inventory";
import { formatDate,formatDateTime } from "@/lib/format";
import { Card,CardHeader,CardTitle,CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/shared/Banner";
export function BranchInventorySummary(){const load=useCallback((signal:AbortSignal)=>fetchInventory(signal),[]);const {data,error}=useAsyncData(load);return <Card><CardHeader className="flex flex-row items-center justify-between gap-2"><CardTitle className="text-base">Closing Inventory</CardTitle><Button asChild size="sm" variant="outline"><Link href="/branch/inventory">View Inventory</Link></Button></CardHeader><CardContent className="text-sm space-y-2">{error?<Banner tone="danger">{error}</Banner>:data?.latest?<><p>Last count: <strong>{formatDate(data.latest.count_date)}</strong></p><p className="text-muted-foreground">{data.latest.submitted_name} · {formatDateTime(data.latest.submitted_at)}</p><p>Check remaining quantities before placing the next order.</p></>:<p className="text-muted-foreground">No employee closing count submitted yet.</p>}</CardContent></Card>;}
