"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/types/database";

export type AuthActionResult = {
  error?: string;
  success?: boolean;
};

export async function signUp(formData: FormData): Promise<AuthActionResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string | null;
  const password = formData.get("password") as string | null;
  const name = formData.get("name") as string | null;

  if (!email || !password || !name) {
    return { error: "All fields are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function signIn(formData: FormData): Promise<AuthActionResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string | null;
  const password = formData.get("password") as string | null;
  const redirectTo = formData.get("redirect") as string | null;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");

  // Get user role to determine redirect destination
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!userError && userData) {
      const userProfile = userData as User;
      const role = userProfile.role;

      // Redirect based on role if no specific redirect is provided
      if (redirectTo) {
        redirect(redirectTo);
      } else if (role === "system_super_admin") {
        redirect("/super-admin");
      } else if (role === "department_admin") {
        redirect("/admin");
      } else {
        redirect("/dashboard");
      }
    }
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/auth/login");
}

export async function signInWithGoogle(): Promise<AuthActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { error: "Failed to initiate Google sign in" };
}

export async function resetPassword(
  formData: FormData,
): Promise<AuthActionResult> {
  const supabase = await createClient();

  const email = formData.get("email") as string | null;

  if (!email) {
    return { error: "Email is required" };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updatePassword(
  formData: FormData,
): Promise<AuthActionResult> {
  const supabase = await createClient();

  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!password || !confirmPassword) {
    return { error: "Both password fields are required" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
