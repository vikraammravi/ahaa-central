export const CATALOG_CATEGORIES = ["Batter", "Curry", "Chutney", "Sweet", "Grocery", "Diary", "Podi"] as const;
export function catalogCategory(category: string): string {
  return category.toLowerCase() === "pantry" ? "Grocery" : category;
}
