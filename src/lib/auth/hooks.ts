"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { UserRole, User } from "@/types/database";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Hook to access the current authentication state
 * Subscribes to auth changes and fetches user profile data
 */
export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
} {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const supabase = createClient();

  const fetchUserProfile = React.useCallback(
    async (authUser: SupabaseUser): Promise<AuthUser | null> => {
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
    },
    [supabase],
  );

  const refreshUser = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const profile = await fetchUserProfile(authUser);
        setUser(profile);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, fetchUserProfile]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  React.useEffect(() => {
    // Get initial session
    refreshUser();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile, refreshUser]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut,
    refreshUser,
  };
}

/**
 * Hook to check if the current user has a specific role
 */
export function useHasRole(requiredRole: UserRole): boolean {
  const { user } = useAuth();

  if (!user) {
    return false;
  }

  const roleHierarchy: Record<UserRole, number> = {
    citizen: 1,
    department_admin: 2,
    system_super_admin: 3,
  };

  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}

/**
 * Hook to check if the current user is a citizen
 */
export function useIsCitizen(): boolean {
  const { user } = useAuth();
  return user?.role === "citizen";
}

/**
 * Hook to check if the current user is a department admin
 */
export function useIsDepartmentAdmin(): boolean {
  const { user } = useAuth();
  return (
    user?.role === "department_admin" || user?.role === "system_super_admin"
  );
}

/**
 * Hook to check if the current user is a super admin
 */
export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === "system_super_admin";
}

/**
 * Hook to get the appropriate dashboard path for the current user
 */
export function useDashboardPath(): string {
  const { user } = useAuth();

  if (!user) {
    return "/auth/login";
  }

  switch (user.role) {
    case "system_super_admin":
      return "/super-admin";
    case "department_admin":
      return "/admin";
    case "citizen":
    default:
      return "/dashboard";
  }
}
