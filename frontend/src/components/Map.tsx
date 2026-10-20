"use client";

import dynamic from "next/dynamic";
import { LoadingBlock } from "@/components/Spinner";

// Leaflet touches `window`, so it can only render in the browser.
const AreaMap = dynamic(() => import("./MatchMap"), {
  ssr: false,
  loading: () => <LoadingBlock className="h-full min-h-72 rounded-lg bg-brand-light" />,
});

export default AreaMap;
export type { MapPoint } from "./MatchMap";
