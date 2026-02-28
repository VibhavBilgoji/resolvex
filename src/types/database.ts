export type UserRole = "citizen" | "department_admin" | "system_super_admin";
export type ComplaintStatus = "open" | "in_progress" | "resolved" | "rejected";
export type PriorityLevel = "low" | "medium" | "high" | "critical";

// ─── AI Summary structured fields ────────────────────────────────────────────
export interface ComplaintSummaryFields {
  one_line_summary: string;
  location_detail: string;
  department_reasoning: string;
  urgency: PriorityLevel;
  urgency_explanation: string;
  key_issues: string[];
  affected_scope: string;
  tags: string[];
}

// ─── Resolution Plan ──────────────────────────────────────────────────────────
export type ResolutionTimeline = "immediate" | "short_term" | "long_term";

export interface ResolutionPlanStep {
  timeline: ResolutionTimeline;
  action: string;
  responsible_party: string;
}

export interface ResolutionPlan {
  executive_summary: string;
  steps: ResolutionPlanStep[];
  required_resources: string[];
  escalation_trigger: string;
  estimated_time: string;
  similar_context: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department_id: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
}

export interface Complaint {
  id: string;
  citizen_id: string;
  title: string;
  original_text: string;
  translated_text: string | null;
  image_url: string | null;

  // Location
  latitude: number | null;
  longitude: number | null;
  address_landmark: string;
  pincode: string;
  municipal_ward: string | null;

  // AI Routing
  category: string | null;
  priority: PriorityLevel | null;
  department_id: string | null;
  status: ComplaintStatus;
  ai_confidence_score: number | null;

  // AI Summary (structured fields extracted by AI pipeline)
  ai_summary: ComplaintSummaryFields | null;

  created_at: string;
  updated_at: string;
}

export interface Resolution {
  id: string;
  complaint_id: string;
  resolved_by: string;
  resolution_text: string;
  resolved_at: string;
  // resolution_embedding is vector(768) — not returned in typical SELECT queries

  // Routing feedback — did the admin confirm the AI routing was correct?
  routing_was_correct: boolean | null;
  // If the admin re-routed, which department did they assign it to?
  admin_corrected_department_id: string | null;
}

// Joined types for UI consumption

export interface ComplaintWithDetails extends Complaint {
  citizen?: Pick<User, "id" | "name" | "email">;
  department?: Pick<Department, "id" | "name">;
  resolution?: Resolution | null;
}

export interface ResolutionWithComplaint extends Resolution {
  complaint?: Pick<Complaint, "id" | "title" | "translated_text" | "category">;
}

// Supabase Database type map (for createClient generics)

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at"> & { created_at?: string };
        Update: Partial<Omit<User, "id">>;
      };
      departments: {
        Row: Department;
        Insert: Omit<Department, "id"> & { id?: string };
        Update: Partial<Omit<Department, "id">>;
      };
      complaints: {
        Row: Complaint;
        Insert: Omit<Complaint, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Complaint, "id" | "created_at">>;
      };
      resolutions: {
        Row: Resolution;
        Insert: Omit<
          Resolution,
          | "id"
          | "resolved_at"
          | "routing_was_correct"
          | "admin_corrected_department_id"
        > & {
          id?: string;
          resolved_at?: string;
          routing_was_correct?: boolean | null;
          admin_corrected_department_id?: string | null;
        };
        Update: Partial<Omit<Resolution, "id">>;
      };
    };
    Enums: {
      user_role: UserRole;
      complaint_status: ComplaintStatus;
      priority_level: PriorityLevel;
    };
  };
}
