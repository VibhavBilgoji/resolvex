"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { UserRole, User as DbUser } from "@/types/database";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  supabaseUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isCitizen: boolean;
  isDepartmentAdmin: boolean;
  isSuperAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [supabaseUser, setSupabaseUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const supabase = createClient();

  const fetchUserProfile = React.useCallback(
    async (authUser: User): Promise<AuthUser | null> => {
      const { data: profile, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error || !profile) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      const userProfile = profile as DbUser;

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
        setSupabaseUser(authUser);
        const profile = await fetchUserProfile(authUser);
        setUser(profile);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
      setSupabaseUser(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase.auth, fetchUserProfile]);

  React.useEffect(() => {
    // Initial fetch
    refreshUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setSupabaseUser(session.user);
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
        setIsLoading(false);
      } else if (event === "SIGNED_OUT") {
        setSupabaseUser(null);
        setUser(null);
        setIsLoading(false);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setSupabaseUser(session.user);
        // Optionally refresh profile on token refresh
      } else if (event === "USER_UPDATED" && session?.user) {
        setSupabaseUser(session.user);
        const profile = await fetchUserProfile(session.user);
        setUser(profile);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, fetchUserProfile, refreshUser]);

  const value: AuthContextType = {
    user,
    supabaseUser,
    isLoading,
    isAuthenticated: !!user,
    isCitizen: user?.role === "citizen",
    isDepartmentAdmin:
      user?.role === "department_admin" || user?.role === "system_super_admin",
    isSuperAdmin: user?.role === "system_super_admin",
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

/**
 * Hook to require authentication
 * Returns the user or throws if not authenticated
 */
export function useRequireAuth(): AuthUser {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    throw new Promise(() => {}); // Suspend for loading state
  }

  if (!user) {
    throw new Error("User not authenticated");
  }

  return user;
}
