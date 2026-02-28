"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const NearbyIssuesMap = dynamic(() => import("./NearbyIssuesMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 overflow-hidden">
      <Skeleton className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map…</p>
      </div>
    </div>
  ),
});

export default function CitizenMapSection() {
  return (
    <NearbyIssuesMap
      mode="citizen"
      height="100%"
      className="absolute inset-0 rounded-none border-0 shadow-none"
    />
  );
}
