"use client";

import { Fragment, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./Spinner";
import { useCompactLayout } from "@/lib/useCompactLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RECORD_CARD_GRID } from "./RecordCards";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  hideOn?: "sm" | "md"; // hide column below this breakpoint
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const hideMap = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
};

export function DataTable<T>({
  data,
  columns,
  loading,
  emptyTitle = "Nothing to show yet",
  emptyBody,
  rowKey,
  onRowClick,
  toolbar,
  footer,
  tableClassName,
  rowClassName,
  expandedContent,
  renderCard,
}: {
  data: T[] | null;
  columns: Column<T>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  rowKey: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  footer?: ReactNode;
  tableClassName?: string;
  rowClassName?: (row: T) => string | undefined;
  expandedContent?: (row: T) => ReactNode;
  renderCard?: (row:T)=>ReactNode;
}) {
  const compact=useCompactLayout();
  if (loading) {
    return (
      <div className="min-w-0 max-w-full border border-border rounded-2xl overflow-hidden bg-surface shadow-sm">
        <LoadingState minHeight="min-h-64" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  const colClass = (c: Column<T>) =>
    cn(
      alignClass[c.align ?? "left"],
      c.hideOn && hideMap[c.hideOn],
      c.className,
    );

  if(compact)return <div className="min-w-0 space-y-3">
    {toolbar&&<div className="min-w-0">{toolbar}</div>}
    <div className={RECORD_CARD_GRID}>{data.map((row,index)=><Card key={rowKey(row,index)} size="sm" className={cn("min-w-0",rowClassName?.(row))}><CardContent className="min-w-0 space-y-3">
      {renderCard?renderCard(row):<dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">{columns.map(column=><div key={column.key} className={cn("min-w-0 break-words [&_input]:max-w-full [&_button]:min-h-10",(!column.header||column.key==="actions"||column.key==="name"||column.key==="product"||column.key==="number")&&"col-span-2")}>
        {column.header&&<dt className="mb-1 text-xs text-muted-foreground">{column.header}</dt>}<dd className="min-w-0 text-sm [&>*]:max-w-full">{column.render(row)}</dd>
      </div>)}</dl>}
      {onRowClick&&!columns.some(column=>column.key==="expand")&&<Button variant="outline" className="min-h-11" onClick={()=>onRowClick(row)}>View details</Button>}
      {expandedContent?.(row)&&<div className="min-w-0 border-t pt-3">{expandedContent(row)}</div>}
    </CardContent></Card>)}</div>
    {footer&&<div className="text-xs text-muted-foreground">{footer}</div>}
  </div>;

  return (
    <div className="min-w-0 max-w-full border border-border rounded-2xl overflow-hidden bg-surface shadow-sm">
      {toolbar && (
        <div className="px-4 py-3 border-b border-border bg-background/40">
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        <Table className={cn("min-w-full", tableClassName)}>
          <TableHeader className="bg-background/60">
            <TableRow className="border-b border-border">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "h-11 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    colClass(c),
                  )}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <Fragment key={rowKey(row, i)}><TableRow
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-accent/40",
                  !onRowClick && "hover:bg-muted/40",
                  rowClassName?.(row),
                )}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn("h-14 px-4 text-sm", colClass(c))}
                  >
                    {c.render(row)}
                  </TableCell>
                ))}
              </TableRow>{expandedContent?.(row) && <TableRow><TableCell colSpan={columns.length} className="p-4 bg-muted/30">{expandedContent(row)}</TableCell></TableRow>}</Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-border bg-background/40 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
