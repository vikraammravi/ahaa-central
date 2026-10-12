"use client";
import { useEffect, useState } from "react";
import { BUSINESS_TIME_ZONE } from "./format";

export function useGreeting() {
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const update = () => {
      const hour = Number(new Intl.DateTimeFormat("en-CA", {timeZone: BUSINESS_TIME_ZONE, hour: "numeric", hourCycle: "h23"}).format(new Date()));
      setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
    };
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener("focus", update);};
  }, []);
  return greeting;
}
