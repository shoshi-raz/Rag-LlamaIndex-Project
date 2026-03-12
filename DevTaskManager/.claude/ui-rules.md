# DevTask Manager - UI Architecture & Guidelines

**Document Version:** 1.0  
**Last Updated:** 2026-02-26  
**Author:** Maria Garcia (Frontend Lead)  
**Status:** Active Development

---

## 1. Design Philosophy

### 1.1 Developer-First Design
- **Speed:** No loading states for standard operations
- **Keyboard:** Full keyboard navigation
- **Information Density:** More data visible
- **Dark Mode:** Default dark theme

### 1.2 Core Principles
1. Performance over polish
2. Progressive disclosure
3. Consistency
4. Accessibility (WCAG 2.1 AA)

---

## 2. Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 18.2+ |
| Build Tool | Vite | 5.0+ |
| State | Zustand | 4.4+ |
| Styling | TailwindCSS | 3.4+ |
| Icons | Heroicons | Latest |
| Forms | React Hook Form | 7.50+ |
| Validation | Zod | 3.22+ |

---

## 3. Component Architecture

```
src/components/
├── common/           # Buttons, Inputs, Cards
├── composite/        # TaskCard, TaskList
├── layout/           # Layout, Navigation
└── features/         # Domain-specific
```

---

## 4. Styling Guidelines

### 4.1 Tailwind Pattern
```
Layout → Box Model → Visual → Typography → Interactions
```

### 4.2 Custom Classes
```css
.btn-primary { @apply px-4 py-2 bg-blue-600 text-white rounded-lg; }
.input { @apply w-full px-3 py-2 border rounded-lg; }
.card { @apply bg-white dark:bg-gray-800 rounded-lg shadow-md; }
```

---

## 5. RTL Support

Implemented via CSS:
```css
[dir="rtl"] { direction: rtl; }
[dir="rtl"] .rtl-flip { transform: scaleX(-1); }
```

Toggle in Layout component sets `document.documentElement.dir`.

---

## 6. Dark Mode

```javascript
document.documentElement.classList.toggle('dark', isDark);
```

Default: Dark mode enabled. Toggle in header.

---

## 7. Form Patterns

```javascript
const schema = z.object({
  title: z.string().min(1).max(200),
  priority: z.enum(['low', 'medium', 'high'])
});
```

---

## 8. State Management

**Zustand Stores:**
- `authStore` - Authentication
- `uiStore` - Modals, toasts
- `preferenceStore` - Theme, RTL (persisted)

---

## 9. Performance

- React.memo for list items
- useCallback for handlers
- Code splitting by route

---

## 10. Accessibility

- ARIA labels on interactive elements
- Focus indicators visible
- Keyboard navigation support
- Color contrast 4.5:1 minimum

---

## Version 0.2 Changes

| Change | Date | Rationale |
|--------|------|-----------|
| Added RTL | 2026-02-20 | Customer requirement |
| Dark mode default | 2026-02-18 | Developer preference |
| Tailwind adopted | 2026-02-15 | Consistency |

---

**⚠️ WARNING:** This document contains active decisions. Discuss with frontend team before modifying patterns.

**Related Documents:**
- `spec.md` - Product requirements
- `architecture.md` - System design
