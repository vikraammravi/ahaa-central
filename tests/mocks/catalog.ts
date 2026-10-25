import { db } from "./supabase";
import type { CatalogItem } from "@/lib/supabase/types";
import { catalogCategory,compareCatalogItems,matchesCatalogFilter } from "@/lib/catalog";
import { stockBadge } from "@/lib/stock";

export function installCatalogRpc(){
  const fallback=db.rpc.getMockImplementation();
  db.rpc.mockImplementation((name,args)=>{
    if(name!=="catalog_page")return fallback?.(name,args);
    const request=Promise.resolve(db.from("catalog_items")).then(result=>{
      const all=(result.data??[]) as CatalogItem[];
      const filtered=all.filter(item=>matchesCatalogFilter(item,args.p_search,args.p_category))
        .filter(item=>args.p_status==="all"||item.is_active===(args.p_status==="active"))
        .filter(item=>args.p_stock_status==="ALL"||stockBadge(args.p_stock_overrides[item.id]??item.available_stock,item.low_stock_threshold??20)===args.p_stock_status)
        .sort(compareCatalogItems);
      const page=Math.min(args.p_page,Math.max(0,Math.ceil(filtered.length/25)-1));
      return {data:{rows:filtered.slice(page*25,page*25+25),page,count:filtered.length,categories:all.map(item=>catalogCategory(item.category))},error:result.error};
    });
    const query={then:request.then.bind(request),abortSignal:()=>query};return query;
  });
}
