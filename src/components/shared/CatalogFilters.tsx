import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "./FormSelect";

export function CatalogFilters({id,search,category,categories,onSearch,onCategory}: {
  id:string;search:string;category:string;categories:string[];onSearch:(value:string)=>void;onCategory:(value:string)=>void;
}) {
  return <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_240px] gap-3">
    <div className="space-y-1.5"><Label htmlFor={`${id}-search`}>Search products</Label><Input id={`${id}-search`} className="h-10 cursor-text" type="search" placeholder="Search product name" value={search} onChange={event=>onSearch(event.target.value)}/></div>
    <div className="space-y-1.5"><Label htmlFor={`${id}-category`}>Category</Label><FormSelect id={`${id}-category`} value={category} onChange={onCategory} options={[{value:"",label:"All categories"},...categories.map(value=>({value,label:value}))]}/></div>
  </div>;
}
