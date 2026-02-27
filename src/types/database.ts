export type UserRole = 'citizen' | 'department_admin' | 'system_super_admin'
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'rejected'
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department_id: string | null
  created_at: string
}

export interface Department {
  id: string
  name: string
  description: string | null
}

export interface Complaint {
  id: string
  citizen_id: string
  title: string
  original_text: string
  translated_text: string | null
  image_url: string | null

  // Location
  latitude: number | null
  longitude: number | null
  address_landmark: string
  pincode: string
  municipal_ward: string | null

  // AI Routing
  category: string | null
  priority: PriorityLevel | null
  department_id: string | null
  status: ComplaintStatus
  ai_confidence_score: number | null

  created_at: string
  updated_at: string
}

export interface Resolution {
  id: string
  complaint_id: string
  resolved_by: string
  resolution_text: string
  resolved_at: string
  // resolution_embedding is vector(768) — not returned in typical SELECT queries
}

// Joined types for UI consumption

export interface ComplaintWithDetails extends Complaint {
  citizen?: Pick<User, 'id' | 'name' | 'email'>
  department?: Pick<Department, 'id' | 'name'>
  resolution?: Resolution | null
}

export interface ResolutionWithComplaint extends Resolution {
  complaint?: Pick<Complaint, 'id' | 'title' | 'translated_text' | 'category'>
}

// Supabase Database type map (for createClient generics)

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<User, 'id'>>
      }
      departments: {
        Row: Department
        Insert: Omit<Department, 'id'> & { id?: string }
        Update: Partial<Omit<Department, 'id'>>
      }
      complaints: {
        Row: Complaint
        Insert: Omit<Complaint, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Complaint, 'id' | 'created_at'>>
      }
      resolutions: {
        Row: Resolution
        Insert: Omit<Resolution, 'id' | 'resolved_at'> & {
          id?: string
          resolved_at?: string
        }
        Update: Partial<Omit<Resolution, 'id'>>
      }
    }
    Enums: {
      user_role: UserRole
      complaint_status: ComplaintStatus
      priority_level: PriorityLevel
    }
  }
}