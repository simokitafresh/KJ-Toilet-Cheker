# KJ-Toilet-Cheker Project Context (AGENT.md)

This document defines the architectural context, business rules, and technical specifications for the **KJ-Toilet-Cheker** project. It serves as the primary source of truth for AI Agents working on this codebase.

---

## 1. Project Identity & Purpose

- **System Name:** KJ-Toilet-Cheker
- **Version:** Phase A Final
- **Purpose:** A toilet check management system designed to ensure regular cleaning intervals (45-90 minutes) and visualize implementation status.
- **Core Philosophy:**
  - **10-Second Rule:** Staff operation (Capture flow) must be completed within 10 seconds.
  - **Semi-Anonymity:** Use animal icons instead of names to reduce psychological burden on staff.
  - **Visualization:** Provide real-time status visibility to prevent missed checks.

## 2. System Architecture

### Infrastructure (Render Platform)
- **Frontend:** Next.js 14+ (App Router, RSC, PWA)
- **Backend:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL (Render Postgres)
- **Storage:** Render Disk (Persistent storage at `/var/data/toilet-images`)
- **Timezone:** Asia/Tokyo (Fixed)

### Application Structure
| Path | Auth | Type | Description |
|------|------|------|-------------|
| `/capture` | None | PWA | Staff camera interface. **No confirmation screen**, **No retries**. |
| `/dashboard` | None | Web | Viewer for Day/Week/Month status and alerts. |
| `/admin` | Basic | Web | Management of settings, staff, and master data. |

## 3. Business Logic & Rules

### Status Determination (The 45-90 Minute Rule)
Calculated based on the interval from the *previous* check:
- **🟢 NORMAL:** 45 minutes ≤ Interval ≤ 90 minutes
- **🟡 TOO_SHORT:** Interval < 45 minutes
- **🔴 TOO_LONG:** Interval > 90 minutes

### Real-time Alerts
- **⚠️ Warning:** 75 minutes elapsed since last check.
- **🔴 Alert:** 90 minutes elapsed since last check.

### Major Checkpoints (Configurable)
Specific time windows (e.g., "Before Open", "Before Close") that *must* have at least one check.
- **Status:** ⏳ Pending / ✅ Completed / 🔴 Missed

## 4. Data & Storage Specifications

### Database Schema (Key Entities)
- **Staff:** `id`, `internal_name` (Hidden from UI), `icon_code` (Unique animal emoji).
- **Toilet:** `id`, `name` (Max 2 locations).
- **Check:** `toilet_id`, `staff_id`, `checked_at`, `status_type`, `images`.
- **Images:** `check_id`, `image_path`, `image_type` (`sheet`, `overview`, `extra`).

### Image Handling Flow
1.  **Capture:** Native camera input (`capture="environment"`).
2.  **Client-side Resize:** Canvas processing -> Max 1280px long edge -> JPEG 75%.
3.  **Upload:** Multipart/form-data to FastAPI.
4.  **Server Validation:** Minimum 2 images required.
5.  **Storage:** Saved to Render Disk (`/var/data/toilet-images/YYYY/MM/DD/{check_id}/`).

## 5. API Interface Strategy

### Public API (No Auth)
- `POST /api/checks`: Submit new check (Images + Metadata).
- `GET /api/checks`: Retrieve checks list.
- `GET /api/dashboard/{view}`: Retrieve aggregated data for Day/Week/Month.
- `GET /api/toilets`, `GET /api/staff`: Master data for UI.

### Admin API (Basic Auth)
- `GET/POST/PATCH/DELETE` endpoints for:
  - `settings` (Clinic config, time windows)
  - `staff` (Manage icons and names)
  - `major-checkpoints` (Critical time windows)
  - `toilets` (Location management)

## 6. Development Guidelines

- **Frontend State:** Minimize client-side state. Use RSC for fetching.
- **Styling:** TailwindCSS.
- **PWA:** `next-pwa` for offline capabilities (though primary use is online).
- **Design:** Simple, high-contrast UI for "at-a-glance" status recognition.
- **Deployment Config:** When creating or modifying `render.yaml`, you MUST refer to `renderyaml_guide.md` to ensure correct network and environment configuration.
