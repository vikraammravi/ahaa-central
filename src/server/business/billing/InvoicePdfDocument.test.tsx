import { cloneElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { expect, it } from "vitest";
import { InvoicePdfDocument } from "@/server/business/billing/InvoicePdfDocument";
import { longCombinedInvoice } from "@tests/mocks/invoice-pdf-layout";

type LayoutNode = { value?: string; children?: LayoutNode[] };

function readText(node: LayoutNode): string {
  return [node.value ?? "", ...(node.children ?? []).map(readText)].join(" ");
}

it("renders long combined invoices with relevant headings on order continuation pages", async () => {
  let pages: LayoutNode[] = [];
  const document = cloneElement(InvoicePdfDocument({ invoice: longCombinedInvoice }), {
    onRender: (result: unknown) => {
      const layout = result as unknown as { _INTERNAL__LAYOUT__DATA_: LayoutNode };
      pages = layout._INTERNAL__LAYOUT__DATA_.children ?? [];
    },
  });

  const blob = await pdf(document).toBlob();
  expect(blob.size).toBeGreaterThan(0);
  const text = pages.map((page) => readText(page).replace(/\s+/g, " ").trim());
  expect(text.length).toBeGreaterThan(2);
  expect(text[0]).toContain("Sample Item 1");
  expect(text[0]).toContain("ITEM / UNIT");
  const lastPage = text.at(-1)!;
  expect(lastPage).toContain("ORDER");
  expect(lastPage).toContain("DATE");
  expect(lastPage).toContain("TOTAL (CA$)");
  expect(lastPage).toMatch(/(?:Order|Invoice)\s*#\s*50/i);
  expect(lastPage).toContain("Nov 2, 2026");
  expect(lastPage).toContain("18.00");
  expect(lastPage).not.toContain("ITEM / UNIT");
});
