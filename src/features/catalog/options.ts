export type CatalogOption = { id: string; name: string; is_active: boolean; ever_used: boolean };
export type CatalogOptionKind = "categories" | "units";
export type CatalogOptions = { categories: CatalogOption[]; units: CatalogOption[] };

export function selectableOptions(options: CatalogOption[], current?: string) {
  return options.filter(option => option.is_active || option.name === current)
    .map(option => ({ value: option.name, label: option.name + (option.is_active ? "" : " (archived)") }));
}
