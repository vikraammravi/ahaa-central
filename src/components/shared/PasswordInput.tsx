"use client";
import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PasswordInput({className,disabled,...props}:Omit<ComponentProps<typeof Input>,"type">) {
  const [visible,setVisible]=useState(false);
  return <div className="relative">
    <Input {...props} disabled={disabled} type={visible?"text":"password"} className={cn("pr-12",className)}/>
    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-11" disabled={disabled} aria-label={visible?"Hide password":"Show password"} aria-pressed={visible} onClick={()=>setVisible(previous=>!previous)}>{visible?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</Button>
  </div>;
}
