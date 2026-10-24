import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarNav } from "@/components/shared/SidebarNav";
import { useUnsavedChanges } from "./useUnsavedChanges";

function EditingScreen({editing,dirty=false,onNavigate}:{editing:boolean;dirty?:boolean;onNavigate:()=>void}) {
  useUnsavedChanges(dirty,"Your changes have not been saved. Leaving this page will discard them.",false,editing);
  return <SidebarNav entries={[{label:"Orders",href:"/branch/invoices"}]} onNavigate={onNavigate}/>;
}

it("uses the shared blurred dialog when a sidebar link is clicked in edit mode",async()=>{
  const navigate=vi.fn();render(<EditingScreen editing onNavigate={navigate}/>);
  const event=new MouseEvent("click",{bubbles:true,cancelable:true});
  fireEvent(screen.getByRole("link",{name:"Orders"}),event);
  expect(event.defaultPrevented).toBe(true);expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog",{name:"Unsaved changes"})).toBeVisible();
  expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass("backdrop-blur-sm","bg-black/40");
  await userEvent.click(screen.getByRole("button",{name:"Keep Editing"}));
  expect(navigate).not.toHaveBeenCalled();expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("continues the original sidebar action only after Leave Page and stops warning after editing ends",async()=>{
  const navigate=vi.fn();const {rerender}=render(<EditingScreen editing dirty onNavigate={navigate}/>);
  const link=screen.getByRole("link",{name:"Orders"});link.addEventListener("click",event=>event.preventDefault());
  fireEvent.click(link);await userEvent.click(screen.getByRole("button",{name:"Leave Page"}));expect(navigate).toHaveBeenCalledOnce();
  rerender(<EditingScreen editing={false} onNavigate={navigate}/>);
  fireEvent.click(link);expect(navigate).toHaveBeenCalledTimes(2);expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
