"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/shared/Spinner";
import { BranchOrderForm } from "@/components/branch/BranchOrderForm";
function BranchOrderRoute(){
  const params=useSearchParams();const editOrderId=params.get("edit");
  return <BranchOrderForm key={editOrderId??"new"} editOrderId={editOrderId}/>;
}
export default function BranchOrderPage(){return <Suspense fallback={<LoadingState label="Loading order…"/>}><BranchOrderRoute/></Suspense>;}
