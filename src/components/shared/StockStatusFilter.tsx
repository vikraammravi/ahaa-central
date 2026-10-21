import { Label } from "@/components/ui/label";
import { FormSelect } from "./FormSelect";

export function StockStatusFilter({id,value,onChange}:{id:string;value:string;onChange:(value:string)=>void}) {
  return <div className="space-y-1.5"><Label htmlFor={id}>Stock Status</Label><FormSelect id={id} value={value} onChange={onChange} options={[{value:"ALL",label:"All statuses"},{value:"in-stock",label:"In stock"},{value:"low-stock",label:"Low stock"},{value:"out-of-stock",label:"Out of stock"}]}/></div>;
}
