import Link from "next/link";
import { FileX, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ComplaintNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FileX className="h-7 w-7 text-muted-foreground" />
          </div>

          <p className="text-5xl font-bold text-muted-foreground/30 mb-2 leading-none">
            404
          </p>

          <CardTitle className="text-xl font-semibold">
            Complaint not found
          </CardTitle>
          <CardDescription className="mt-2 leading-relaxed">
            This complaint doesn&apos;t exist, has been removed, or you don&apos;t
            have permission to view it. Only the citizen who filed it can view
            their complaint.
          </CardDescription>
        </CardHeader>

        <CardContent className="py-0">
          <div className="rounded-md bg-muted px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              If you believe this is a mistake, please verify the complaint ID
              in the URL or check your complaints list.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-6">
          <Button className="w-full" asChild>
            <Link href="/complaints">
              <ArrowLeft className="size-4" />
              Back to My Complaints
            </Link>
          </Button>

          <Button variant="outline" className="w-full" asChild>
            <Link href="/complaints/new">
              <Plus className="size-4" />
              File a New Complaint
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}