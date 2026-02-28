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

interface AdminMapSectionProps {
  departmentId: string | null;
}

export default function AdminMapSection({
  departmentId,
}: AdminMapSectionProps) {
  return (
    <NearbyIssuesMap
      mode="admin"
      departmentId={departmentId}
      height="100%"
      className="absolute inset-0 rounded-none border-0 shadow-none"
    />
  );
}
