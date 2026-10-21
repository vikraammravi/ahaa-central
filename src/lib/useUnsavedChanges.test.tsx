import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarNav } from "@/components/shared/SidebarNav";
import { useUnsavedChanges } from "./useUnsavedChanges";

function EditingScreen({editing,dirty=false,onNavigate}:{editing:boolean;dirty?:boolean;onNavigate:()=>void}) {
  useUnsavedChanges(dirty,"Leave and discard unsaved changes?",false,editing);
  return <SidebarNav entries={[{label:"Orders",href:"/branch/invoices"}]} onNavigate={onNavigate}/>;
}

it("warns on sidebar navigation immediately in edit mode and blocks navigation when declined",()=>{
  const navigate=vi.fn();const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
  render(<EditingScreen editing onNavigate={navigate}/>);
  const event=new MouseEvent("click",{bubbles:true,cancelable:true});
  fireEvent(screen.getByRole("link",{name:"Orders"}),event);
  expect(confirm).toHaveBeenCalledOnce();expect(event.defaultPrevented).toBe(true);expect(navigate).not.toHaveBeenCalled();
});

it("allows the sidebar after confirmation and removes the warning after editing ends",()=>{
  const navigate=vi.fn();const confirm=vi.spyOn(window,"confirm").mockReturnValue(true);
  const {rerender}=render(<EditingScreen editing dirty onNavigate={navigate}/>);
  // Prevent jsdom's actual navigation after verifying the sidebar handler runs.
  const link=screen.getByRole("link",{name:"Orders"});link.addEventListener("click",event=>event.preventDefault());
  fireEvent.click(link);expect(confirm).toHaveBeenCalledOnce();expect(navigate).toHaveBeenCalledOnce();
  rerender(<EditingScreen editing={false} onNavigate={navigate}/>);
  fireEvent.click(link);expect(confirm).toHaveBeenCalledOnce();expect(navigate).toHaveBeenCalledTimes(2);
});
