"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  updateComplaintStatus,
  resolveComplaint,
} from "@/lib/resolutions/actions";
import type { ComplaintStatus, Department } from "@/types/database";

interface AdminResolutionFormProps {
  complaintId: string;
  currentStatus: ComplaintStatus;
  allowReopen?: boolean;
  /** Departments list for routing correction selector */
  departments?: Pick<Department, "id" | "name">[];
  /** The department currently assigned by AI (to pre-fill the selector) */
  currentDepartmentId?: string | null;
}

type ActionMode = "status" | "resolve" | "reject" | "reopen" | null;
type RoutingVerdict = "correct" | "incorrect" | null;

export function AdminResolutionForm({
  complaintId,
  currentStatus,
  allowReopen = false,
  departments = [],
  currentDepartmentId = null,
}: AdminResolutionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<ActionMode>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Routing feedback state
  const [routingVerdict, setRoutingVerdict] = useState<RoutingVerdict>(null);
  const [correctedDeptId, setCorrectedDeptId] = useState<string>(
    currentDepartmentId ?? "",
  );

  function reset() {
    setMode(null);
    setResolutionText("");
    setError(null);
    setSuccessMsg(null);
    setRoutingVerdict(null);
    setCorrectedDeptId(currentDepartmentId ?? "");
  }

  async function handleStatusChange(
    newStatus: "open" | "in_progress" | "rejected",
  ) {
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await updateComplaintStatus(complaintId, newStatus);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMsg(`Status updated to "${newStatus.replace("_", " ")}".`);
        setMode(null);
        router.refresh();
      }
    });
  }

  async function handleResolve() {
    setError(null);
    setSuccessMsg(null);

    if (resolutionText.trim().length < 20) {
      setError("Resolution note must be at least 20 characters.");
      return;
    }

    startTransition(async () => {
      const feedback =
        routingVerdict !== null
          ? {
              wasCorrect: routingVerdict === "correct",
              correctedDepartmentId:
                routingVerdict === "incorrect" && correctedDeptId
                  ? correctedDeptId
                  : null,
            }
          : undefined;

      const result = await resolveComplaint(
        complaintId,
        resolutionText,
        feedback,
      );
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMsg(
          "Complaint resolved successfully. The resolution has been saved and will be embedded into the knowledge base shortly.",
        );
        setMode(null);
        setResolutionText("");
        router.refresh();
      }
    });
  }

  // ── Reopen / super-admin section ────────────────────────────────────────────
  if (allowReopen) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="size-4" />
            Super Admin Actions
          </CardTitle>
          <CardDescription>
            Re-open or reject this complaint as a super admin override.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMsg && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-300">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              {successMsg}
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300">
              <XCircle className="size-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || currentStatus === "open"}
              onClick={() => handleStatusChange("open")}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Clock className="size-4" />
              )}
              Re-open
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || currentStatus === "in_progress"}
              onClick={() => handleStatusChange("in_progress")}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              Mark In Progress
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending || currentStatus === "rejected"}
              onClick={() => handleStatusChange("rejected")}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <XCircle className="size-4" />
              )}
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Normal admin action panel ────────────────────────────────────────────────
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="size-4 text-primary" />
          Admin Actions
        </CardTitle>
        <CardDescription>
          Update the status of this complaint or write a resolution note to
          close it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feedback messages */}
        {successMsg && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-300">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-300">
            <XCircle className="size-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* ── Mode: no panel open — show action buttons ─────────────────────── */}
        {mode === null && (
          <div className="flex flex-wrap gap-2">
            {currentStatus === "open" && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleStatusChange("in_progress")}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <AlertTriangle className="size-4 text-blue-600" />
                )}
                Mark In Progress
              </Button>
            )}
            {currentStatus === "in_progress" && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleStatusChange("open")}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Clock className="size-4 text-yellow-600" />
                )}
                Revert to Open
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              disabled={isPending}
              onClick={() => setMode("resolve")}
            >
              <CheckCircle2 className="size-4" />
              Resolve with Note
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => setMode("reject")}
            >
              <XCircle className="size-4" />
              Reject
            </Button>
          </div>
        )}

        {/* ── Mode: resolve panel ──────────────────────────────────────────── */}
        {mode === "resolve" && (
          <div className="space-y-4 pt-2 border-t border-border">
            {/* Resolution text */}
            <div className="space-y-1.5">
              <Label htmlFor="resolution-text" className="text-sm font-medium">
                Resolution Note{" "}
                <span className="text-muted-foreground font-normal">
                  (min. 20 characters)
                </span>
              </Label>
              <Textarea
                id="resolution-text"
                placeholder="Describe the steps taken to resolve this complaint, including any work done, dates, and the final outcome…"
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                rows={5}
                className="resize-none"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                {resolutionText.length} characters —{" "}
                {resolutionText.trim().length < 20
                  ? `${20 - resolutionText.trim().length} more needed`
                  : "ready to submit"}
              </p>
            </div>

            {/* ── Routing feedback ─────────────────────────────────────────── */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-0.5">
                  AI Routing Feedback
                </p>
                <p className="text-xs text-muted-foreground">
                  Help improve future routing accuracy by confirming whether the
                  AI assigned this complaint to the right department.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={routingVerdict === "correct" ? "default" : "outline"}
                  size="sm"
                  disabled={isPending}
                  onClick={() => setRoutingVerdict("correct")}
                  className={
                    routingVerdict === "correct"
                      ? "bg-green-600 hover:bg-green-700 text-white border-0"
                      : "border-green-200 text-green-700 dark:border-green-800 dark:text-green-400"
                  }
                >
                  <ThumbsUp className="size-3.5" />
                  Routing was correct
                </Button>
                <Button
                  type="button"
                  variant={
                    routingVerdict === "incorrect" ? "default" : "outline"
                  }
                  size="sm"
                  disabled={isPending}
                  onClick={() => setRoutingVerdict("incorrect")}
                  className={
                    routingVerdict === "incorrect"
                      ? "bg-red-600 hover:bg-red-700 text-white border-0"
                      : "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400"
                  }
                >
                  <ThumbsDown className="size-3.5" />
                  Routing was wrong
                </Button>
              </div>

              {/* Department correction selector */}
              {routingVerdict === "incorrect" && departments.length > 0 && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="corrected-dept"
                    className="text-xs font-medium text-foreground"
                  >
                    Which department should have handled this?
                  </Label>
                  <select
                    id="corrected-dept"
                    value={correctedDeptId}
                    onChange={(e) => setCorrectedDeptId(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Select correct department —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleResolve}
                disabled={isPending || resolutionText.trim().length < 20}
                size="sm"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {isPending ? "Saving…" : "Submit Resolution"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={reset}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Mode: reject confirmation ────────────────────────────────────── */}
        {mode === "reject" && (
          <div className="space-y-4 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to reject this complaint? This action will
              mark it as rejected and it will be visible to the citizen.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() => handleStatusChange("rejected")}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <XCircle className="size-4" />
                )}
                {isPending ? "Rejecting…" : "Yes, Reject"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={reset}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
