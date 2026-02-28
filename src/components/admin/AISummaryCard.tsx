import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  MapPin,
  Building2,
  AlertTriangle,
  Tag,
  Users,
  Layers,
} from "lucide-react";
import type { ComplaintSummaryFields, PriorityLevel } from "@/types/database";

interface AISummaryCardProps {
  summary: ComplaintSummaryFields;
}

function urgencyBadgeClass(urgency: PriorityLevel): string {
  switch (urgency) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800";
  }
}

function SectionRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

export function AISummaryCard({ summary }: AISummaryCardProps) {
  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <Brain className="size-4 shrink-0" />
          AI Complaint Analysis
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed text-foreground/80 font-medium">
          {summary.one_line_summary}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Urgency */}
        <SectionRow
          icon={<AlertTriangle className="size-4" />}
          label="Urgency Assessment"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={urgencyBadgeClass(summary.urgency)}>
              {summary.urgency}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {summary.urgency_explanation}
            </p>
          </div>
        </SectionRow>

        {/* Location */}
        <SectionRow
          icon={<MapPin className="size-4" />}
          label="Location Detail"
        >
          <p className="text-sm text-foreground">{summary.location_detail}</p>
        </SectionRow>

        {/* Department reasoning */}
        <SectionRow
          icon={<Building2 className="size-4" />}
          label="Department Assignment"
        >
          <p className="text-sm text-foreground">
            {summary.department_reasoning}
          </p>
        </SectionRow>

        {/* Key issues */}
        <SectionRow
          icon={<Layers className="size-4" />}
          label="Key Issues"
        >
          <ul className="space-y-1">
            {summary.key_issues.map((issue, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                <span className="mt-1.5 size-1.5 rounded-full bg-blue-500 shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        </SectionRow>

        {/* Affected scope */}
        <SectionRow
          icon={<Users className="size-4" />}
          label="Affected Scope"
        >
          <p className="text-sm text-foreground">{summary.affected_scope}</p>
        </SectionRow>

        {/* Tags */}
        {summary.tags && summary.tags.length > 0 && (
          <SectionRow icon={<Tag className="size-4" />} label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {summary.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"
                >
                  {tag}
                </span>
              ))}
            </div>
          </SectionRow>
        )}
      </CardContent>
    </Card>
  );
}
