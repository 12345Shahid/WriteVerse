# Core Collaborative Features Roadmap

This document outlines the primary roadmap for implementing team-based and project-based features in WriterAI.

## 1. Team Management
**Confidence Score: 90/100**
*Standard relational modeling; Supabase Auth handles the heavy lifting.*

### What it is
A system allowing multiple users (writers, editors, owners) to collaborate inside one workspace.

### Functional Breakdown
*   **Workspaces (Organizations)**: Users belong to one or more workspaces.
*   **Invite System**: Admins invite members via email/link.
*   **Roles & Permissions**:
    *   `Owner`: Full billing/admin access.
    *   `Admin`: Manage members and settings.
    *   `Editor`: Create/Edit content.
    *   `Viewer`: Read-only.
*   **Seat Allocation**: Limits based on subscription plan.
*   **Audit Logs**: Track who did what (created, edited, deleted).

### Database Requirements
*   `organizations` table.
*   `organization_members` table (links `users` to `organizations` with `role`).
*   **RLS Refactor**: Update all content tables (`saved_results`, etc.) to check `org_id` membership instead of just `user_id`.

---

## 2. Team Chat / Collaboration Chat
**Confidence Score: 85/100**
*Straightforward schema; Real-time complexity is the main variable.*

### What it is
A shared chat interface for team members to talk to AI and collaborate.

### Functional Breakdown
*   **Shared Threads**: AI conversations accessible by the whole team.
*   **Mentions**: "@User" tagging to notify team members.
*   **Threading**: Reply to specific messages.
*   **Export**: Convert chat to document/template.
*   **Shared Context**: Persistent instructions/files for the chat room.

### Database Requirements
*   `chat_threads` (linked to `org_id`).
*   `chat_messages` (linked to `thread_id` and `user_id`).
*   `chat_mentions` (for notifications).

### Detailed Implementation Steps
1.  **Database**:
    *   Create `chat_threads` table (Topic, OrgID, CreatedBy).
    *   Create `chat_messages` table (ThreadID, UserID, Role, Content).
    *   Enable RLS and **Supabase Realtime** for `chat_messages`.
2.  **Backend API**:
    *   `GET /api/chat/threads`: List organization threads.
    *   `POST /api/chat/threads`: Start a new conversation.
    *   `GET /api/chat/threads/:id/messages`: Fetch history.
    *   `POST /api/chat/threads/:id/messages`: Send user message. This endpoint will also trigger the AI response, which will be inserted into the DB (streaming or final text).
3.  **Frontend**:
    *   **Chat Interface**: Two-pane layout (Thread list, Active Chat).
    *   **Real-time**: Use Supabase Client subscription to listen for new messages.
    *   **Markdown Support**: Render AI responses with formatting.

---

## 3. Project Management
**Confidence Score: 95/100**
*Standard CRUD; High value, low technical risk.*

### What it is
A workspace area to create, track, and organize content projects.

### Functional Breakdown
*   **Projects/Folders**: Group content by campaign or department.
*   **Tasks**: "Write intro", "SEO Review", "Final Polish".
*   **Workflow Statuses**: Draft -> Review -> Approved -> Published.
*   **Assignments**: Assign content pieces to specific team members.
*   **Versioning**: History of AI rewrites and human edits.
*   **Deadlines**: Due dates and calendar view.

### Database Requirements
*   `projects` table (linked to `org_id`).
*   `project_tasks` table.
*   Link `saved_results` (content) to `projects`.

---

## 4. File Management / Asset Management
**Confidence Score: 80/100**
*Metadata is easy; RAG (Retrieval Augmented Generation) is complex.*

### What it is
A library to upload, store, and use files (PDFs, Images, Brand Docs) for AI input.

### Functional Breakdown
*   **Upload & Organize**: Folders, tags, categories.
*   **Search**: Full-text search on file contents.
*   **Project Attachments**: Link files to specific tasks/chats.
*   **AI Context Injection**: "Read this PDF and write a blog post based on it."

### Database Requirements
*   `assets` table (metadata, path in storage, `org_id`).
*   **Vector Store** (`pgvector` extension):
    *   `document_embeddings` table to store chunked vectors for RAG.

---

## 5. Template Functionality
**Confidence Score: 90/100**
*Flexible backend logic required, but data model is simple.*

### What it is
Custom AI templates for structured outputs (Ads, Social, Internal Docs).

### Functional Breakdown
*   **Library**: Pre-built vs. Custom templates.
*   **Custom Builder**: Define inputs (e.g., "Product Name", "Audience") and the Prompt.
*   **Sharing**: Templates available to the whole workspace.
*   **Variables**: `{brand_voice}`, `{audience}` injection.
*   **Auto-Fill**: Pull context from the active Project.

### Database Requirements
*   `content_templates` table (`org_id`, `schema`, `prompt_text`).

### Detailed Implementation Steps
1.  **Database**:
    *   Create `content_templates` table with `schema` (JSONB) for dynamic form fields.
    *   Enable RLS for Organization-based access.
2.  **Backend API**:
    *   `GET /api/templates`: List custom templates.
    *   `POST /api/templates`: Create new template.
    *   `PUT /api/templates/:id`: Update template.
    *   `DELETE /api/templates/:id`: Delete template.
    *   `POST /api/generate-template`: Dynamic generation endpoint using template schema.
3.  **Frontend**:
    *   **Templates Hub**: Dashboard section to manage custom templates.
    *   **Template Builder**: UI to define input fields (Text, Number, Select) and map them to the Prompt.
    *   **Template Runner**: Generic component to render the form based on the template's JSON schema and execute the generation.
