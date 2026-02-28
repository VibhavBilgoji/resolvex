"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MapPin, Upload, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { submitComplaint } from "@/lib/complaints/actions";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const complaintSchema = z.object({
  title: z
    .string()
    .min(10, "Title must be at least 10 characters.")
    .max(150, "Title must be at most 150 characters."),
  original_text: z
    .string()
    .min(20, "Description must be at least 20 characters.")
    .max(2000, "Description must be at most 2000 characters."),
  address_landmark: z
    .string()
    .min(5, "Please enter a recognisable landmark or address.")
    .max(300, "Address is too long."),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Enter a valid 6-digit Indian pincode."),
});

type ComplaintFormValues = z.infer<typeof complaintSchema>;

export function ComplaintForm() {
  const [isPending, startTransition] = useTransition();

  // Location state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintSchema),
  });

  // ── Location helpers ──────────────────────────────────────────────────────

  function handleLocateMe() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLocationStatus("error");
      return;
    }

    setLocationStatus("loading");
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationStatus("success");
        toast.success("Location captured successfully.");
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. You can still enter your address manually."
            : "Unable to retrieve your location. Please enter your address manually.";
        setLocationError(msg);
        setLocationStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function clearLocation() {
    setLatitude(null);
    setLongitude(null);
    setLocationStatus("idle");
    setLocationError(null);
  }

  // ── Image helpers ─────────────────────────────────────────────────────────

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageError(null);

    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Only JPEG, PNG, WebP, or GIF images are allowed.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("Image must be smaller than 5 MB.");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ── Drag and drop helpers ─────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSubmitting) setIsDraggingOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (isSubmitting) return;

    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) return;

    setImageError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Only JPEG, PNG, WebP, or GIF images are allowed.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("Image must be smaller than 5 MB.");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function onSubmit(values: ComplaintFormValues) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("title", values.title);
      fd.append("original_text", values.original_text);
      fd.append("address_landmark", values.address_landmark);
      fd.append("pincode", values.pincode);

      if (latitude !== null) fd.append("latitude", String(latitude));
      if (longitude !== null) fd.append("longitude", String(longitude));
      if (imageFile) fd.append("image", imageFile);

      const result = await submitComplaint(fd);

      // If we reach here submitComplaint did NOT redirect (only errors land here)
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  const isSubmitting = isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">

      {/* ── Section 1: Complaint details ── */}
      <div className="space-y-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Complaint Details
        </h2>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Subject / Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g. Broken streetlight near Main Gate, Ward 12"
            {...register("title")}
            aria-invalid={!!errors.title}
            disabled={isSubmitting}
          />
          {errors.title && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="size-3 shrink-0" />
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="original_text">
            Description <span className="text-red-500">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Describe the issue in your own language (Hindi, Tamil, Telugu, Marathi, English, etc.)
          </p>
          <Textarea
            id="original_text"
            placeholder="अपनी समस्या यहाँ लिखें… / Describe the problem here…"
            rows={5}
            {...register("original_text")}
            aria-invalid={!!errors.original_text}
            disabled={isSubmitting}
            className="resize-none"
          />
          {errors.original_text && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="size-3 shrink-0" />
              {errors.original_text.message}
            </p>
          )}
        </div>
      </div>

      {/* ── Section 2: Location ── */}
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Location
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use the &ldquo;Locate Me&rdquo; button for GPS accuracy, and always fill in the address fields below.
          </p>
        </div>

        {/* GPS Locate Me button */}
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                {locationStatus === "idle" && (
                  <p className="text-sm text-muted-foreground">
                    GPS location not captured. This is optional but improves routing accuracy.
                  </p>
                )}
                {locationStatus === "loading" && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="size-4 animate-spin" /> Fetching your location…
                  </p>
                )}
                {locationStatus === "success" && latitude !== null && longitude !== null && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium truncate">
                      GPS captured: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </p>
                  </div>
                )}
                {locationStatus === "error" && locationError && (
                  <p className="text-sm text-red-500 flex items-start gap-1.5">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    {locationError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                {locationStatus !== "success" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLocateMe}
                    disabled={isSubmitting || locationStatus === "loading"}
                  >
                    {locationStatus === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MapPin className="size-4" />
                    )}
                    Locate Me
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearLocation}
                    disabled={isSubmitting}
                  >
                    <X className="size-4" />
                    Clear GPS
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Landmark / Address */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address_landmark">
              Landmark / Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="address_landmark"
              placeholder="e.g. Near SBI Bank, MG Road, Sector 4"
              {...register("address_landmark")}
              aria-invalid={!!errors.address_landmark}
              disabled={isSubmitting}
            />
            {errors.address_landmark && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" />
                {errors.address_landmark.message}
              </p>
            )}
          </div>

          {/* Pincode */}
          <div className="space-y-1.5">
            <Label htmlFor="pincode">
              Pincode <span className="text-red-500">*</span>
            </Label>
            <Input
              id="pincode"
              placeholder="e.g. 400001"
              maxLength={6}
              inputMode="numeric"
              {...register("pincode")}
              aria-invalid={!!errors.pincode}
              disabled={isSubmitting}
            />
            {errors.pincode && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" />
                {errors.pincode.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Image upload ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Photo Evidence <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload a photo of the issue. Max 5 MB. JPEG, PNG, WebP, or GIF.
          </p>
        </div>

        {!imagePreview ? (
          <label
            htmlFor="image-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer
              transition-colors
              ${isSubmitting ? "opacity-50 pointer-events-none" : ""}
              ${isDraggingOver
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30 hover:border-primary hover:bg-primary/5"
              }
            `}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground pointer-events-none">
              <Upload className={`size-8 transition-opacity ${isDraggingOver ? "opacity-100 text-primary" : "opacity-60"}`} />
              <p className="text-sm font-medium">
                {isDraggingOver ? "Drop to upload" : "Click to upload a photo"}
              </p>
              <p className="text-xs">or drag and drop</p>
            </div>
            <input
              id="image-upload"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageChange}
              disabled={isSubmitting}
            />
          </label>
        ) : (
          <div className="relative w-full max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Complaint preview"
              className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={removeImage}
              disabled={isSubmitting}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
              aria-label="Remove image"
            >
              <X className="size-4" />
            </button>
            <p className="mt-1.5 text-xs text-muted-foreground truncate">
              {imageFile?.name}
            </p>
          </div>
        )}

        {imageError && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="size-3 shrink-0" />
            {imageError}
          </p>
        )}
      </div>

      {/* ── AI processing note + Submit ── */}
      {isSubmitting && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Loader2 className="size-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              AI is routing your complaint…
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              Gemini is translating your description, detecting your municipal ward, and assigning the right department. This usually takes 5–15 seconds. Please don&apos;t close or refresh the page.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-muted-foreground mr-auto">
          <span className="text-red-500">*</span> Required fields
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          size="lg"
          className="min-w-40"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing…
            </>
          ) : (
            "Submit Complaint"
          )}
        </Button>
      </div>
    </form>
  );
}
