# Navigation & Routing Structure (Phase 3)

## Overview
This document outlines the complete navigation and routing system for Revenew-OS.

## Route Hierarchy

```
/
├── /dashboard (Growth Command Center)
│   ├── /orders (Order Management)
│   ├── /customers (Customer Database)
│   ├── /messages (WhatsApp Communications)
│   ├── /analytics (Detailed Analytics)
│   ├── /reports (Custom Reports)
│   ├── /settings (App Configuration)
│   └── /help (Help & Support)
├── /auth (Authentication Routes)
│   ├── /login
│   ├── /signup
│   └── /forgot-password
└── / (Public Landing Page)
```

## Navigation Configuration

The navigation structure is defined in `config/navigation.ts`:

```typescript
export const navigationConfig: NavSection[] = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', ... },
      { id: 'orders', label: 'Orders', href: '/orders', badge: 12, ... },
      // ... more items
    ],
  },
];
```

### Key Features:
- **Icons**: Each nav item has a Lucide icon
- **Badges**: Display notification counts (e.g., Orders badge shows count)
- **Sections**: Navigation organized into Main, Analytics, and Settings sections
- **Active State**: Current page is highlighted in sidebar
- **Breadcrumbs**: Automatic breadcrumb generation from route

## Components

### Sidebar (`components/layout/Sidebar.tsx`)
- Collapsible navigation sidebar
- Responsive (hidden on mobile, toggle button)
- Integrates with `navigationConfig`
- Shows active nav item
- Supports badges for notifications

### TopNav (`components/layout/TopNav.tsx`)
- Sticky header with breadcrumbs
- Search button (cmd+K)
- Dark mode toggle
- User profile dropdown

### PageHeader (`components/layout/PageHeader.tsx`)
- Reusable page header component
- Supports breadcrumbs
- Optional action buttons
- Title and description

### Dashboard Layout (`app/(dashboard)/layout.tsx`)
- Master layout for all dashboard routes
- Integrates Sidebar + TopNav
- Responsive flex layout

## Page Templates

All dashboard pages follow this template:

```tsx
'use client';

import { PageHeader } from '@/components/layout/PageHeader';

export default function PageName() {
  return (
    <div>
      <PageHeader
        title="Page Title"
        description="Page description"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Current Page' },
        ]}
      />
      <div className="p-6">
        {/* Page content */}
      </div>
    </div>
  );
}
```

## Routing Utilities

### `config/navigation.ts`
- **`navigationConfig`**: Main navigation structure
- **`flattenNavItems()`**: Flatten nested nav items for search/lookup
- **`getBreadcrumbs()`**: Get breadcrumb trail for a given path

## Usage

### Accessing Navigation in Components

```tsx
import { navigationConfig } from '@/config/navigation';

// Use in your component
navigationConfig.forEach(section => {
  section.items.forEach(item => {
    console.log(item.label, item.href);
  });
});
```

### Creating New Routes

1. Add item to `navigationConfig`
2. Create new directory: `app/(dashboard)/[route-name]/`
3. Create `page.tsx` with PageHeader
4. Component automatically appears in sidebar with icon

## Future Enhancements

- [ ] Route permissions/auth guards
- [ ] Dynamic breadcrumb generation
- [ ] Route transitions/animations
- [ ] Command palette integration (Phase 5)
- [ ] Advanced routing patterns (nested routes)
