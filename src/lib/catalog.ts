export const CATALOG_CATEGORIES = ["Batter", "Curry", "Chutney", "Desserts", "Grocery", "Diary", "Podi", "Packaging"] as const;
export function catalogCategory(category: string): string {
  const value = category.trim().toLowerCase();
  if (value === "pantry") return "Grocery";
  if (value === "sweet") return "Desserts";
  return category;
}

export function matchesCatalogFilter(item: {name:string;category:string}, search:string, category:string): boolean {
  return item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (!category || catalogCategory(item.category) === category);
}
export function compareCatalogItems(a:{name:string;category?:string},b:{name:string;category?:string}):number {
  return catalogCategory(a.category??"").localeCompare(catalogCategory(b.category??""),"en",{sensitivity:"base"})||a.name.localeCompare(b.name,"en",{sensitivity:"base"});
}
