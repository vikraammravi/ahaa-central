import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackLink } from "@/components/shared/BackLink";

it("back links preserve their destination",()=>{render(<BackLink href="/admin/invoices">Back to Invoices</BackLink>);expect(screen.getByRole("link",{name:"Back to Invoices"})).toHaveAttribute("href","/admin/invoices");});
