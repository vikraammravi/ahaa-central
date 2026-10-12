export const PAGE_SIZE = 25;
export function pageRange(page: number): [number, number] {
  return [page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1];
}
export function lastPage(count: number): number {
  return Math.max(0, Math.ceil(count / PAGE_SIZE) - 1);
}
// Quote PostgREST values so punctuation cannot introduce another filter.
export function searchFilter(columns: string[], search: string): string {
  const literal = search.trim().replace(/\\/g, "\\\\").replace(/[%_*]/g, "\\$&");
  const pattern = `%${literal}%`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return columns.map(column => `${column}.ilike."${pattern}"`).join(",");
}
