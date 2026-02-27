# Smart Citizen Grievance Redressal System

## 1. Project Overview & Architecture
An end-to-end citizens' complaint system built for Indian contexts, featuring AI-driven routing, language translation, location extraction, and automated categorizations based on past resolution data.

### Tech Stack
- **Framework:** Next.js (App Router, Server Actions, Route Handlers)
- **Language / Runtime:** TypeScript, Bun
- **UI:** Tailark Components + Tailwind CSS
- **Database & Auth:** Supabase (Postgres + Storage + Auth + pgvector)
- **AI Integration:** Gemini API orchestrated via LangChain

### High-Level Architecture
1. **Frontend:** Next.js Client Components (Tailark) for responsive UI with hybrid location inputs and multilingual support.
2. **Backend/API:** Next.js Server Actions handle form submissions. Route Handlers process async AI operations.
3. **Storage:** User-uploaded images go to Supabase Storage; structured data to Supabase Postgres.
4. **AI/RAG Pipeline:** When a new complaint is filed:
   - **Translation:** The `original_text` (in any Indian language) is translated to `translated_text` (English) by Gemini.
   - **Location Extraction:** Gemini parses the user's manual address/pincode to determine the specific Municipal Council and Ward.
   - **Context Retrieval:** The English `translated_text` is embedded using LangChain + Gemini and a similarity search is performed against pgvector (storing past resolutions).
   - **Routing & Assignment:** Gemini API uses the retrieved context to intelligently predict the `category`, `department`, and `priority`.
5. **Admin Flow:** Admins update the status. Once resolved, the resolution text is vectorized and stored in pgvector, creating a continuous improvement learning loop.

## 2. Database Schema Outline (Supabase Postgres)

```sql
-- ENUMS
CREATE TYPE user_role AS ENUM ('citizen', 'department_admin', 'system_super_admin');
CREATE TYPE complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'rejected');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');

-- USERS
CREATE TABLE users (
    id UUID REFERENCES auth.users PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role DEFAULT 'citizen',
    department_id UUID NULL, -- For admin routing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DEPARTMENTS
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- e.g., Water Board, PWD, Electricity
    description TEXT
);

-- COMPLAINTS
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_id UUID REFERENCES users(id),
    title TEXT NOT NULL,
    original_text TEXT NOT NULL,     -- User's prompt (multilingual)
    translated_text TEXT,            -- English translation via Gemini
    image_url TEXT,
    
    -- Location Strategy
    latitude FLOAT,                  -- From HTML5 'Locate Me' button (Optional)
    longitude FLOAT,                 -- From HTML5 'Locate Me' button (Optional)
    address_landmark TEXT NOT NULL,  -- Mandatory text input
    pincode TEXT NOT NULL,           -- Mandatory text input
    municipal_ward TEXT,             -- AI Extracted via Gemini based on address/pincode
    
    -- AI Routing Result
    category TEXT,                   -- AI Assigned
    priority priority_level,         -- AI Assigned
    department_id UUID REFERENCES departments(id), -- AI Assigned
    status complaint_status DEFAULT 'open',
    ai_confidence_score FLOAT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RESOLUTIONS (for RAG & History)
CREATE TABLE resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID REFERENCES complaints(id),
    resolved_by UUID REFERENCES users(id),
    resolution_text TEXT NOT NULL,
    resolution_embedding vector(768), -- pgvector storage for RAG
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 3. Step-by-Step Implementation Plan

### Phase 1: Project Initialization & Setup
- Initialize Next.js project with App Router and Bun.
- Install and configure Tailark UI components and Tailwind CSS.
- Set up Supabase project, initialize tables, and enable the `pgvector` extension.
- Configure environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`).

### Phase 2: Authentication, Roles & Security (RLS)
- Implement Supabase Auth (Email/Password or OAuth).
- **Set up restrictive Supabase RLS policies immediately:**
  - *Citizens* can only insert and read their own complaints via `citizen_id = auth.uid()`.
  - *Department Admins* can read and update all complaints within their `department_id`.
  - *Super Admins* have unrestricted read/write access.
- Create Role-based middleware to protect Next.js routes.

### Phase 3: Core Submission Flow (Citizen View)
- Build the `Complaint Form` UI matching Indian infrastructure nuances (Tailark components).
- Implement the "Hybrid Location Strategy":
  - Add an HTML5 "Locate Me" button to optionally fetch Lat/Lng.
  - Add required text fields for "Landmark / Address" and "Pincode".
- Implement image upload to Supabase Storage.
- Create Next.js Server Action to submit the form data to the database.

### Phase 4: AI Brain & RAG Integration (The Hackathon Edge)
- Set up LangChain & Gemini API utility functions.
- Build the "Routing Engine" pipeline processing the submitted complaint:
  1. **Translation:** Pass the `original_text` to Gemini for language detection and translate it into English. Save as `translated_text`.
  2. **Location Intelligence:** Parse the user's `address_landmark` and `pincode` with Gemini to automatically determine and extract the specific `municipal_ward` (e.g., mapping an address to its Municipal Council).
  3. **Contextual Retrieval:** Embed the English `translated_text` and perform a vector search across the `resolutions` table.
  4. **Categorization & Routing:** Prompt Gemini with the RAG context, translated text, and location data to determine the correct `category`, `priority`, and `department_id`.
  5. Update the Postgres record with the AI-determined values.

### Phase 5: Admin Dashboards & Resolution Loop
- **Department Admin UI:** Protected dashboard filtering complaints by the admin's `department_id`. Include options to filter by `municipal_ward`.
- Admin action to update the complaint status and write a detailed "Resolution Note".
- **The Learning Loop:** Once a complaint is marked 'resolved', trigger a route handler to embed the `resolution_text` + `complaint summary` into the `resolution_embedding` pgvector column. This ensures future complaints benefit from past resolutions.
- **Super Admin UI:** High-level metrics showing overall system usage, AI confidence accuracy, and department performance.

### Phase 6: Polish and Delivery
- Add loading states (React Suspense, Tailark skeletons), error handling, and toast notifications.
- Final review of edge cases (e.g., failed API calls, missing location data fallback).