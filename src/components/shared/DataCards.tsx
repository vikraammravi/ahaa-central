import type { ReactNode } from "react";
import { Card,CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RECORD_CARD_GRID } from "./RecordCards";
import type { Column } from "./DataTable";

export function DataCards<T>({data,columns,rowKey,rowClassName,renderCard,onRowClick,expandedContent}:{
  data:T[];columns:Column<T>[];rowKey:(row:T,index:number)=>string;
  rowClassName?:(row:T)=>string|undefined;renderCard?:(row:T)=>ReactNode;
  onRowClick?:(row:T)=>void;expandedContent?:(row:T)=>ReactNode;
}) {
  return <div className={RECORD_CARD_GRID}>{data.map((row,index)=>{
    const expanded=expandedContent?.(row);
    return <Card key={rowKey(row,index)} size="sm" className={cn("min-w-0",rowClassName?.(row))}><CardContent className="min-w-0 space-y-3">
      {renderCard?renderCard(row):<dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">{columns.map(column=><div key={column.key} className={cn("min-w-0 break-words [&_input]:max-w-full [&_button]:min-h-10",(column.cardSpan===2||!column.header)&&"col-span-2")}>
        {column.header&&<dt className="mb-1 text-xs text-muted-foreground">{column.header}</dt>}<dd className="min-w-0 text-sm [&>*]:max-w-full">{column.render(row)}</dd>
      </div>)}</dl>}
      {onRowClick&&<Button variant="outline" className="min-h-11" onClick={()=>onRowClick(row)}>View details</Button>}
      {expanded&&<div className="min-w-0 border-t pt-3">{expanded}</div>}
    </CardContent></Card>;
  })}</div>;
}
