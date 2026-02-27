import { createClient } from "@/lib/supabase/server";
import type { UserRole, User } from "@/types/database";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
}

/**
 * Get the currently authenticated user with their profile data
 * Use this in Server Components and Server Actions
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  // Fetch user profile from the users table
  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (error || !profile) {
    return null;
  }

  const userProfile = profile as User;

  return {
    id: userProfile.id,
    email: userProfile.email,
    name: userProfile.name,
    role: userProfile.role,
    departmentId: userProfile.department_id,
  };
}

/**
 * Get the current session
 * Use this when you only need to check if a user is authenticated
 */
export async function getSession() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

/**
 * Require authentication - throws redirect if not authenticated
 * Use this at the top of Server Components/Actions that require auth
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

/**
 * Require a specific role - throws error if user doesn't have the required role
 */
export async function requireRole(requiredRole: UserRole): Promise<AuthUser> {
  const user = await requireAuth();

  const roleHierarchy: Record<UserRole, number> = {
    citizen: 1,
    department_admin: 2,
    system_super_admin: 3,
  };

  const userLevel = roleHierarchy[user.role];
  const requiredLevel = roleHierarchy[requiredRole];

  if (userLevel < requiredLevel) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

/**
 * Check if user is a citizen
 */
export function isCitizen(user: AuthUser): boolean {
  return user.role === "citizen";
}

/**
 * Check if user is a department admin
 */
export function isDepartmentAdmin(user: AuthUser): boolean {
  return user.role === "department_admin" || user.role === "system_super_admin";
}

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(user: AuthUser): boolean {
  return user.role === "system_super_admin";
}

/**
 * Get the appropriate dashboard path for a user based on their role
 */
export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case "system_super_admin":
      return "/super-admin";
    case "department_admin":
      return "/admin";
    case "citizen":
    default:
      return "/dashboard";
  }
}
