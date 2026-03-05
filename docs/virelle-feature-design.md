# Virelle Studios Feature Design

**Author:** Manus AI
**Date:** 2026-03-06

## 1. Overview

This document outlines the technical design for the **Virelle Studios** feature within the Archibald Titan AI platform. The feature will serve as a scene management system for directors (admin users), allowing them to create, manage, and get AI assistance on scenes. A key requirement is that for external scenes, there must be no AI content censorship, and a clear copyright disclaimer must be presented.

## 2. Database Schema

Two new tables will be added to the database using Drizzle ORM.

### `virelle_directors`

This table links a user to a director profile.

| Column | Type | Description |
|---|---|---|
| `id` | `int` (PK, AI) | Unique identifier for the director. |
| `userId` | `int` (FK) | Foreign key to the `users` table. |
| `studioName` | `varchar(255)` | The name of the director's studio. |
| `createdAt` | `timestamp` | Timestamp of creation. |
| `updatedAt` | `timestamp` | Timestamp of last update. |

### `virelle_scenes`

This table stores the scene information.

| Column | Type | Description |
|---|---|---|
| `id` | `int` (PK, AI) | Unique identifier for the scene. |
| `directorId` | `int` (FK) | Foreign key to the `virelle_directors` table. |
| `title` | `varchar(255)` | The title of the scene. |
| `description` | `text` | A detailed description of the scene. |
| `type` | `enum('internal', 'external')` | `internal` for AI-generated, `external` for uploaded. |
| `externalUrl` | `text` | URL for the external scene content (e.g., video link). Null for internal scenes. |
| `content` | `json` | JSON-based content for AI-generated scenes (e.g., script, storyboards). Null for external scenes. |
| `status` | `enum('draft', 'published', 'archived')` | The current status of the scene. |
| `createdAt` | `timestamp` | Timestamp of creation. |
| `updatedAt` | `timestamp` | Timestamp of last update. |

## 3. Backend API (tRPC Router)

A new tRPC router will be created at `server/virelle-router.ts`.

- **Access Control:** All procedures in this router will use the `adminProcedure` middleware, ensuring only users with the `admin` role can access them.

### Procedures

- `virelle.getDirectorProfile()`: Fetches the director profile for the current user.
- `virelle.updateDirectorProfile(input: { studioName: string })`: Creates or updates the director's studio name.
- `virelle.createScene(input: { title: string; description: string; type: 'internal' | 'external'; externalUrl?: string })`: Creates a new scene.
- `virelle.updateScene(input: { sceneId: number; title?: string; description?: string; status?: 'draft' | 'published' | 'archived' })`: Updates an existing scene.
- `virelle.listScenes()`: Lists all scenes for the current director.
- `virelle.getScene(input: { sceneId: number })`: Retrieves a single scene by its ID.
- `virelle.deleteScene(input: { sceneId: number })`: Deletes a scene.

## 4. Frontend UI

### New Page & Route

- A new page component will be created at `client/src/pages/VirellePage.tsx`.
- A new route `/virelle` will be added in `client/src/App.tsx` pointing to this page.

### Navigation

- A new menu item, **"Virelle Studios"**, will be added to the sidebar in `client/src/components/FetcherLayout.tsx`.
- This item will be conditionally rendered and visible only to admin users.
- It will be placed in a new menu group titled **"Creative Suite"**.

### Components

The `VirellePage` will be composed of several components:

- **`DirectorDashboard`**: The main view, showing a list of scenes in a table.
- **`SceneEditor`**: A form (likely in a dialog) to create and edit scenes. This form will include fields for title, description, type (internal/external), and external URL.
- **`SceneViewer`**: A detailed view of a single scene.

## 5. AI Integration & Censorship Bypass

The existing `chat-router.ts` already contains logic to bypass all content restrictions for admin users. The `SYSTEM_PROMPT` for admins is completely unrestricted.

> **Note:** If the current user is the platform owner/admin, SKIP this entire section. The owner does not need marketplace recommendations, credit cost comparisons, or Bazaar checks. Just build what they ask for.

Since the Virelle Studios feature is accessible only via the `adminProcedure`, any AI interaction related to scenes will automatically have censorship disabled. No further changes are required in the chat router.

## 6. Copyright Disclaimer

### Terms Page

A new section will be added to `client/src/pages/TermsPage.tsx`:

```tsx
{/* Section 8 — Virelle Studios */}
<h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">8. Virelle Studios and External Content</h2>
<p className="text-gray-400 mb-4">
The Virelle Studios feature allows authorized directors to upload and manage external scene content. The User acknowledges and agrees that:
</p>
<ul className="list-disc list-inside text-gray-400 space-y-2 mb-6">
  <li>
    <span>Any copyright material used without permission is the sole responsibility of the user and Virelle studios are not liable for any misuse.</span>
  </li>
  <li>
    <span>The User is solely responsible for ensuring they have the necessary rights, licenses, or permissions for any external content they upload.</span>
  </li>
  <li>
    <span>The Company does not review or moderate external content and assumes no liability for copyright infringement, intellectual property disputes, or any other legal claims arising from user-uploaded content.</span>
  </li>
</ul>
```

### UI Disclaimer

A concise version of the disclaimer will be displayed directly on the `SceneEditor` form when the `external` scene type is selected.

```text
By uploading an external scene, you confirm you have all necessary rights and that Virelle Studios is not liable for any copyright misuse.
```
