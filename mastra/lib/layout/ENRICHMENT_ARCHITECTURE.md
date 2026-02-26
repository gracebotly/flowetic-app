# Enrichment Boundaries Per Skeleton Category

## Critical Insight

`transformDataForComponents()` only touches data-bound components (Dashboard skeletons A-E + CRUDTable from I).
Product skeletons (F-H) and most Admin skeletons (J-K) use static/config-driven props set at build time,
not event-driven enrichment.

This is correct behavior, not a bug.

## Skeleton Categories

```text
┌─────────────────────────────────────────────────────────────────┐
│                    SKELETON CATEGORIES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DASHBOARD (A-E): DATA-BOUND                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Events (Supabase) → transformDataForComponents()       │    │
│  │ → enrichMetricCard, enrichTimeseriesChart,             │    │
│  │   enrichCategoryChart, enrichBarChart, enrichDataTable,│    │
│  │   enrichInsightCard, enrichStatusFeed, enrichCRUDTable │    │
│  │                                                         │    │
│  │ Components receive raw field mappings at build time,    │    │
│  │ then real computed values at render time from events.   │    │
│  │                                                         │    │
│  │ UIHeader + SectionHeader: PASS-THROUGH (no enrichment) │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  PRODUCT (F-H): STATIC / CONFIG-DRIVEN                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Props set at build time by buildProductComponentsFrom- │    │
│  │ Skeleton(). No event enrichment needed.                │    │
│  │                                                         │    │
│  │ F (Landing Page): hero title, features array, pricing  │    │
│  │   cards, CTA text — all from agent conversation or     │    │
│  │   template defaults. No live data.                     │    │
│  │                                                         │    │
│  │ G (Form Wizard): step definitions, field configs,      │    │
│  │   validation rules — all from schema/config.           │    │
│  │   User input is captured at runtime, not enriched.     │    │
│  │                                                         │    │
│  │ H (Results Display): success banner text, result cards │    │
│  │   — populated from workflow output at display time,    │    │
│  │   NOT from event aggregation.                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ADMIN (I-K): MIXED                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ I (CRUD Panel): CRUDTable IS data-bound (uses          │    │
│  │   enrichCRUDTable → enrichDataTable). PageHeader,      │    │
│  │   FilterBar, Pagination are config-driven.             │    │
│  │                                                         │    │
│  │ J (Settings): All config-driven. Sidebar nav, form     │    │
│  │   fields, danger zone — all from schema. No events.    │    │
│  │                                                         │    │
│  │ K (Auth Flow): All config-driven. Auth form fields,    │    │
│  │   brand visual — from tenant config. No events.        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Industry Pattern Alignment (2026)

Getflowetic maps to the declarative generative UI pattern used in CopilotKit, A2UI, Open-JSON-UI,
and Shopify SDUI ecosystems:

1. **Component Registry Pattern**
   - `componentRegistry.ts` provides a finite set of pre-built renderers.
   - AI selects components and fills props from known capabilities.

2. **Data Binding Separation**
   - UI structure is represented by skeleton + component declarations.
   - Application state binding is performed by `transformDataForComponents()`.
   - Structure and state evolve independently.

3. **Two Enrichment Modes**
   - **Data-bound mode (Dashboard + CRUDTable):** runtime aggregation from events via field mappings.
   - **Config-driven mode (Product + Settings/Auth):** complete props generated at build time.

4. **Capability Map Composition**
   - UI is composed only from registered component capabilities.
   - Skeleton selection controls capability usage; enrichment activates only for data-bound types.

## Development Rules

### DO NOT

- Add `enrichLandingPage()` or `enrichAuthForm()` to `transformDataForComponents()`.
- Force Product/Admin skeletons through event enrichment paths.
- Route Product skeleton generation through dashboard data-signal capacity logic.

### DO

- Add enrichment functions only for new data-bound component types (for example `GaugeChart` or `HeatmapChart`).
- Keep Product/Admin builders isolated (`buildProductComponentsFromSkeleton`, `buildAdminComponentsFromSkeleton`).
- Use `selectSkeleton()` capacity gate skip-list as the source of truth for config-driven skeletons:

```typescript
const skipCapacityCheck = [
  'saas-landing-page',      // F - Product
  'workflow-input-form',    // G - Product
  'results-display',        // H - Product
  'admin-crud-panel',       // I - Admin (CRUDTable inside is data-bound)
  'settings-dashboard',     // J - Admin
  'authentication-flow',    // K - Admin
].includes(candidate);
```
