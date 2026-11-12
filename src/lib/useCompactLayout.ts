"use client";

import { useSyncExternalStore } from "react";

const query = "(max-width: 1023px)";
const wideQuery = "(max-width: 1439px)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function subscribeWide(onChange: () => void) {
  const media = window.matchMedia(wideQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useCompactLayout(wide = false) {
  return useSyncExternalStore(wide ? subscribeWide : subscribe, () => window.matchMedia(wide ? wideQuery : query).matches, () => false);
}
