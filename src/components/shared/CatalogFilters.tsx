import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "./FormSelect";
import { FilterBar } from "./FilterBar";

export function CatalogFilters({id,search,category,categories,onSearch,onCategory,inline=false}: {
  id:string;search:string;category:string;categories:string[];onSearch:(value:string)=>void;onCategory:(value:string)=>void;
  inline?:boolean;
}) {
  const fields=<>
    <div className="space-y-1.5"><Label htmlFor={`${id}-search`}>Search products</Label><Input id={`${id}-search`} className="h-10 cursor-text" type="search" placeholder="Search product name" value={search} onChange={event=>onSearch(event.target.value)}/></div>
    <div className="space-y-1.5"><Label htmlFor={`${id}-category`}>Category</Label><FormSelect id={`${id}-category`} value={category} onChange={onCategory} options={[{value:"",label:"All categories"},...categories.map(value=>({value,label:value}))]}/></div>
  </>;
  return inline?fields:<FilterBar>{fields}</FilterBar>;
}
