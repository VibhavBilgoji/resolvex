"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlidingSidebarProps {
  children: React.ReactNode;
}

export default function SlidingSidebar({ children }: SlidingSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <aside
      className="absolute top-0 bottom-0 left-0 z-30 flex pointer-events-auto"
      style={{
        transform: open ? "translateX(0)" : "translateX(calc(-100% + 24px))",
        transition: "transform 350ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Sliding panel */}
      <div className="w-72 h-full overflow-y-auto bg-background/95 backdrop-blur-lg border-r border-border shadow-2xl">
        <div className="pt-16 pb-8 px-4 space-y-4">{children}</div>
      </div>

      {/* Pull-tab handle — always the 24 px visible strip */}
      <div className="flex flex-col items-center justify-center w-6 self-center h-20 bg-background/90 backdrop-blur-md border-y border-r border-border rounded-r-xl shadow-lg cursor-pointer select-none">
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </div>
    </aside>
  );
}
