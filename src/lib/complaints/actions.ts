"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/utils";

export type ComplaintActionResult = {
  error?: string;
  complaintId?: string;
};

export type ComplaintFormData = {
  title: string;
  original_text: string;
  address_landmark: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  image?: File | null;
};

async function uploadComplaintImage(
  file: File,
  citizenId: string,
): Promise<string | null> {
  const adminClient = createAdminClient();

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${citizenId}/${Date.now()}.${ext}`;

  const { error } = await adminClient.storage
    .from("complaint-images")
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Image upload error:", error.message);
    return null;
  }

  const { data: urlData } = adminClient.storage
    .from("complaint-images")
    .getPublicUrl(filename);

  return urlData?.publicUrl ?? null;
}

export async function submitComplaint(
  formData: FormData,
): Promise<ComplaintActionResult> {
  const user = await getUser();

  if (!user) {
    return { error: "You must be logged in to file a complaint." };
  }

  // Extract fields
  const title = (formData.get("title") as string | null)?.trim();
  const original_text = (formData.get("original_text") as string | null)?.trim();
  const address_landmark = (formData.get("address_landmark") as string | null)?.trim();
  const pincode = (formData.get("pincode") as string | null)?.trim();
  const latRaw = formData.get("latitude") as string | null;
  const lngRaw = formData.get("longitude") as string | null;
  const imageFile = formData.get("image") as File | null;

  // Validate required fields
  if (!title) return { error: "Title is required." };
  if (!original_text) return { error: "Description is required." };
  if (!address_landmark) return { error: "Landmark / Address is required." };
  if (!pincode) return { error: "Pincode is required." };

  if (!/^\d{6}$/.test(pincode)) {
    return { error: "Pincode must be a valid 6-digit Indian pincode." };
  }

  const latitude = latRaw ? parseFloat(latRaw) : null;
  const longitude = lngRaw ? parseFloat(lngRaw) : null;

  // Upload image if provided
  let image_url: string | null = null;
  if (imageFile && imageFile.size > 0) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(imageFile.type)) {
      return { error: "Only JPEG, PNG, WebP, or GIF images are allowed." };
    }
    if (imageFile.size > 5 * 1024 * 1024) {
      return { error: "Image must be smaller than 5 MB." };
    }

    image_url = await uploadComplaintImage(imageFile, user.id);
    if (image_url === null) {
      return { error: "Image upload failed. Please try again." };
    }
  }

  // Use admin client to bypass RLS for the insert (citizen_id is set explicitly)
  const adminClient = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient as any)
    .from("complaints")
    .insert({
      citizen_id: user.id,
      title,
      original_text,
      address_landmark,
      pincode,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      image_url,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Complaint insert error:", error?.message);
    return { error: "Failed to submit complaint. Please try again." };
  }

  const complaintId = (data as { id: string }).id;

  revalidatePath("/dashboard");
  revalidatePath("/complaints");

  redirect(`/complaints/${complaintId}?submitted=true`);
}