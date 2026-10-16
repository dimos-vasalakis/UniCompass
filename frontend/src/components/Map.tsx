"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so it can only render in the browser.
const AreaMap = dynamic(() => import("./MatchMap"), {
  ssr: false,
  loading: () => <div className="h-full min-h-72 w-full animate-pulse rounded-lg bg-brand-light" />,
});

export default AreaMap;
export type { MapPoint } from "./MatchMap";
