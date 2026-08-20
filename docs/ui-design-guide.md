# Rebecca AI - UI Policy & Design Guide

## 1. Design Philosophy
This document establishes the UI design guidelines and component implementation policies for the Rebecca AI Admin Dashboard. It ensures that future development maintains a consistent, premium user experience.

### Core Principles
- **Premium Command Center Experience**: The dashboard should not feel like a generic CRUD app. It must feel like a "State-of-the-Art AI Command Center".
- **Glassmorphism Theme**: Utilize `backdrop-filter: blur()`, subtle semi-transparent backgrounds, and fine highlighting borders to create depth and immersion. Dark mode is the primary and only supported theme.
- **Objective Clarity**: Keep visual hierarchy clean. Avoid cluttering the screen. Group related data logically.
- **No Native OS Selects/Alerts**: Native browser dropdowns (`<select>`) and modals (`alert`, `confirm`) are strictly prohibited in production as they break the immersive dark theme. Custom dropdowns and modals must be used.

## 2. Color Palette & Typography
- **Primary Color**: `var(--color-primary)` (#9b59b6) - Rebecca Purple
- **Secondary Color**: `var(--color-secondary)` (#8e44ad)
- **Background Base**: `var(--bg-base)` (#0f0f11) - Pitch dark with subtle radial gradients.
- **Surface Level 1 (Glass)**: `var(--bg-surface)` (rgba(26, 26, 29, 0.65))
- **Text**: `var(--text-main)` (#f0f0f0) for primary, `var(--text-muted)` (#888890) for secondary.
- **Semantic Colors**: 
  - Success: `var(--success)` (#2ed573)
  - Danger/Error: `var(--danger)` (#ff4757)
- **Typography**: `Inter` for all UI text, providing clean, modern, and highly legible geometric sans-serif shapes.

## 3. Angular Component Strategy (Atomic Design)
We adhere to an Atomic Design-like component architecture to maximize reusability and maintainability.

### A. Atoms (Minimal Building Blocks)
- **CSS Utility vs. Angular Component**: If an element has no complex internal state or behavior (e.g., standard `.btn`), prefer pure CSS utility classes to avoid Angular component overhead.
- **Stateful Atoms**: If an element requires state tracking, `ngModel` support, or complex event emission (e.g., `<app-checkbox>`), build it as an Angular Standalone Component.

### B. Molecules (Simple UI Groups)
- Combine atoms or native elements to form functional units.
- **Examples**: `<app-custom-dropdown>` (replaces `<select>`), `<app-date-picker-popover>`.

### C. Organisms (Complex Functional Sections)
- Independent, context-aware sections of the UI that can manage their own data or wrap complex layouts.
- **Examples**: `<app-right-drawer>` (Generic sliding drawer container), `<app-bulk-action-bar>`.

### D. Templates & Pages (Views)
- Page components (`DashboardPageComponent`, `MemoryPageComponent`) assemble Organisms.
- Pages should act as "Smart Components", handling repository injections, API calls, and passing data down to "Dumb Components" (Molecules/Organisms) via `@Input()` and `@Output()`.

## 4. Interaction & Feedback Guidelines
- **Loading States**: Any button triggering an asynchronous action (e.g., "Force Dreaming", "Delete") MUST display a loading spinner inside the button and become `disabled` to prevent double submissions.
- **Drawers vs. Modals**:
  - **Drawers**: Use right-sliding drawers for examining detailed context (e.g., viewing a specific Post, User profile, or Memory configuration). This preserves the underlying list context.
  - **Modals**: Use center-screen modals only for focused, terminal actions (e.g., "Are you sure you want to delete?") or full-screen overlays (e.g., Lightbox for images).
- **Bulk Actions**: Checkboxes in tables must trigger a sticky/contextual Bulk Action Bar. Do not permanently reserve vertical space for bulk action buttons if no items are selected.
- **Hover Effects**: All interactive elements (buttons, table rows with `.clickable`, cards) must have subtle CSS transitions (`transform: translateY()`, `box-shadow`, or `background-color` changes) to indicate interactivity.

## 5. Directory Structure Standard
```
src/app/
 ├── features/          # Smart page components grouped by feature (Dashboard, Memory, etc.)
 ├── layout/            # Global layout components (Sidebar, Topnav, AI Drawer)
 ├── shared/
 │    └── components/   # Reusable Atomic Design components
 │         ├── atoms/      # E.g., checkbox
 │         ├── molecules/  # E.g., dropdown, date-picker
 │         └── organisms/  # E.g., right-drawer, bulk-action-bar, lightbox
 └── core/              # Services, Repositories, Interfaces, Interceptors
```
