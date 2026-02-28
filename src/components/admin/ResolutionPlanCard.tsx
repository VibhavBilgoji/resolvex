"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Calendar,
  PackageOpen,
  AlertOctagon,
  Timer,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { generateResolutionPlanAction } from "@/lib/ai/actions";
import type { ResolutionPlan, ResolutionTimeline } from "@/types/database";

interface ResolutionPlanCardProps {
  complaintId: string;
}

const TIMELINE_META: Record<
  ResolutionTimeline,
  { label: string; icon: React.ReactNode; badgeClass: string }
> = {
  immediate: {
    label: "Immediate (< 24 h)",
    icon: <Zap className="size-3.5" />,
    badgeClass:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  short_term: {
    label: "Short-term (< 1 week)",
    icon: <Clock className="size-3.5" />,
    badgeClass:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  },
  long_term: {
    label: "Long-term / Preventive",
    icon: <Calendar className="size-3.5" />,
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
};

function StepRow({
  step,
  index,
}: {
  step: ResolutionPlan["steps"][number];
  index: number;
}) {
  const meta = TIMELINE_META[step.timeline] ?? TIMELINE_META.short_term;
  return (
    <div className="flex gap-3 py-3 border-b border-border/60 last:border-0">
      {/* Step number */}
      <div className="shrink-0 mt-0.5 size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-medium text-foreground leading-snug">
          {step.action}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={`text-[10px] font-medium flex items-center gap-1 ${meta.badgeClass}`}
          >
            {meta.icon}
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {step.responsible_party}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ResolutionPlanCard({ complaintId }: ResolutionPlanCardProps) {
  const [plan, setPlan] = useState<ResolutionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();

  function fetchPlan() {
    setError(null);
    startTransition(async () => {
      const result = await generateResolutionPlanAction(complaintId);
      if (result.error) {
        setError(result.error);
      } else {
        setPlan(result.plan ?? null);
        setExpanded(true);
      }
    });
  }

  return (
    <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base flex items-center gap-2 text-violet-700 dark:text-violet-400">
              <Sparkles className="size-4 shrink-0" />
              AI Resolution Plan
            </CardTitle>
            <CardDescription className="mt-0.5">
              {plan
                ? "AI-generated step-by-step resolution guidance based on this complaint and similar past cases."
                : "Generate an AI-powered resolution plan with concrete steps, timelines, and resource requirements."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {plan && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
                className="h-8 px-2"
              >
                {expanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant={plan ? "outline" : "default"}
              disabled={isPending}
              onClick={fetchPlan}
              className={
                plan
                  ? ""
                  : "bg-violet-600 hover:bg-violet-700 text-white border-0"
              }
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Generating…
                </>
              ) : plan ? (
                <>
                  <RefreshCw className="size-3.5" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Generate Plan
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Error */}
      {error && (
        <CardContent className="pt-0">
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300">
            <AlertOctagon className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </CardContent>
      )}

      {/* Plan content */}
      {plan && expanded && (
        <CardContent className="pt-0 space-y-5">
          {/* Executive summary */}
          <div className="p-3 rounded-lg bg-card border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Executive Summary
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {plan.executive_summary}
            </p>
          </div>

          {/* Steps */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Action Steps
            </p>
            <div className="rounded-lg border border-border bg-card divide-y divide-border/60 overflow-hidden">
              {plan.steps.map((step, i) => (
                <div key={i} className="px-4">
                  <StepRow step={step} index={i} />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom metadata row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Required resources */}
            {plan.required_resources && plan.required_resources.length > 0 && (
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <PackageOpen className="size-3.5" />
                  Required Resources
                </p>
                <ul className="space-y-1">
                  {plan.required_resources.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-foreground"
                    >
                      <span className="mt-1.5 size-1 rounded-full bg-muted-foreground shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              {/* Estimated time */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Timer className="size-3.5" />
                  Estimated Resolution Time
                </p>
                <p className="text-sm font-medium text-foreground">
                  {plan.estimated_time}
                </p>
              </div>

              {/* Escalation trigger */}
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertOctagon className="size-3.5" />
                  Escalate When
                </p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {plan.escalation_trigger}
                </p>
              </div>
            </div>
          </div>

          {/* Similar context */}
          {plan.similar_context &&
            plan.similar_context !== "No similar cases found" && (
              <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <BookOpen className="size-3.5" />
                  Lessons from Similar Cases
                </p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {plan.similar_context}
                </p>
              </div>
            )}
        </CardContent>
      )}
    </Card>
  );
}
