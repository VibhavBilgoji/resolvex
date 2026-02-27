// Auth utilities - Server-side (use in Server Components, Server Actions, Route Handlers)
export {
  getUser,
  getSession,
  requireAuth,
  requireRole,
  isCitizen,
  isDepartmentAdmin,
  isSuperAdmin,
  getDashboardPath,
  type AuthUser,
} from "./utils";

// Auth actions - Server Actions for authentication
export {
  signUp,
  signIn,
  signOut,
  signInWithGoogle,
  resetPassword,
  updatePassword,
  type AuthActionResult,
} from "./actions";

// Auth hooks - Client-side (use in Client Components)
export {
  useAuth,
  useHasRole,
  useIsCitizen,
  useIsDepartmentAdmin,
  useIsSuperAdmin,
  useDashboardPath,
} from "./hooks";
