---
name: getflowetic-frontend-design
description: Dashboard design intelligence for GetFlowetic's designAdvisorAgent. Provides industry-specific style bundles, platform-appropriate aesthetics, and BM25 search integration with UI/UX Pro Max knowledge base. Use when generating style bundles (Phase 3), handling interactive edits (Phase 5), or providing design guidance for Vapi, n8n, Make, or Retell dashboards. Combines distinctive frontend design principles with searchable design databases (67 styles, 96 color palettes, 56 font pairings, 100 reasoning rules).
---

# GetFlowetic Frontend-Design Skill

This skill provides design intelligence for GetFlowetic's designAdvisorAgent, combining distinctive frontend design principles with BM25-based search of UI/UX Pro Max design databases.

## Architecture Overview

**NOT traditional RAG (vector embeddings)** — Uses BM25 keyword search with CSV databases:

```
CSV Databases (7 domains) → BM25 Search Engine → JSON Results
├── products.csv (100 product types with reasoning rules)
├── styles.csv (67 UI styles)
├── colors.csv (96 color palettes)
├── typography.csv (56 font pairings)
├── landing-pages.csv (24 page patterns)
├── charts.csv (25 chart types)
└── ux-guidelines.csv (98 best practices)
```

**Search Method:** Python script with BM25 ranking + regex matching

## Core Design Principles

### Typography
- **NEVER:** Inter, Roboto, Arial, system fonts
- **ALWAYS:** Distinctive fonts (e.g., Cormorant Garamond, Montserrat, Crimson Pro, Public Sans, Space Grotesk)
- Pair display + body fonts with purpose
- Client-facing: 16px+ body text
- Internal ops: 14px+ body text

### Color & Theme
- Commit to cohesive aesthetic (not random colors)
- Dominant colors with sharp accents
- Use CSS variables for consistency
- Industry-appropriate palettes
- Sufficient contrast (WCAG AA: 4.5:1 minimum)

### Motion
- High-impact moments: staggered reveals, scroll-triggered animations
- CSS-only for HTML, Motion library for React
- 150-300ms transitions for hover states
- Respect `prefers-reduced-motion`

### Spatial Composition
- Unexpected layouts, asymmetry, overlap, diagonal flow
- Generous negative space OR controlled density (audience-dependent)
- Break grids intentionally

### Backgrounds & Visual Details
- Gradient meshes, noise textures, layered transparencies
- Contextual effects (not random decoration)
- Depth via shadows, gradients, layering

## Search Integration

### The 7 Searchable Domains

See `references/search-domains.md` for complete domain documentation.

| Domain | What It Contains | When to Use |
|--------|------------------|-------------|
| **product** | 100 product categories with industry rules | Initial design system generation |
| **style** | 67 UI styles | Style bundle generation, refinement |
| **color** | 96 industry palettes | Color mood selection |
| **typography** | 56 font pairings | Typography selection |
| **landing** | 24 page patterns | Page structure guidance |
| **chart** | 25 chart types | Dashboard data visualization |
| **ux** | 98 UX guidelines | Accessibility, best practices |

### Search Command Patterns

**Design System Generator (Phase 3 — Always run first):**
```bash
python3 /path/to/search.py "{platformType} {audience} {outcome}" --design-system -p "{ProjectName}"
```

Example:
```bash
python3 search.py "vapi call center client-facing dashboard" --design-system -p "Acme Corp"
```

**Domain-Specific Searches (Phase 3, 5 — For refinement):**
```bash
python3 search.py "{keywords}" --domain {style|color|typography|landing|chart|ux}
```

Examples:
```bash
# Style alternatives
python3 search.py "glassmorphism dark mode" --domain style

# Color palette refinement
python3 search.py "fintech blue professional" --domain color

# Typography variations
python3 search.py "elegant luxury serif" --domain typography

# Chart recommendations
python3 search.py "real-time metrics gauge" --domain chart

# UX validation
python3 search.py "contrast wcag accessibility" --domain ux
```

## Phase 3: Style Bundle Generation

**Goal:** Generate 4 distinct style bundles for user to choose from.

### Step 1: Run Design System Generator

```bash
python3 search.py "{platformType} {audience} {outcome}" --design-system -p "{ProjectName}"
```

**Output includes:**
- Recommended Pattern (landing page structure)
- Style recommendation (from 67 styles)
- Color palette (5 colors with HEX codes)
- Typography pairing (display + body fonts with Google Fonts link)
- Key effects (animations, transitions)
- Anti-patterns to avoid
- Pre-delivery checklist

### Step 2: Generate 4 Style Bundle Variations

**Bundle 1: Primary Recommendation**
- Match the design system output exactly
- This is the "safest" choice based on reasoning rules

**Bundle 2: Alternative Same-Category Style**
- If primary is Glassmorphism → try Neumorphism
- If primary is Minimalism → try Swiss Modernism 2.0
- Keep color mood similar

**Bundle 3: Opposite Aesthetic**
- If primary is Maximalist → try Minimalist
- If primary is Light → try Dark Mode
- Provide visual contrast to Bundle 1

**Bundle 4: Platform-Specific Variation**
- n8n → Use purples (brand color)
- Vapi → Use blues (professional communication)
- Make → Use greens (productivity)
- Retell → Use warm neutrals (approachable)

### Step 3: Format Each Bundle

Each bundle must include:
- **Preview description** (visual appearance)
- **Palette** (5 color dots with HEX codes)
- **Typography** (font pairing with Google Fonts link)
- **2-3 tags** (e.g., "Client-facing", "Premium", "High-contrast")

Example bundle:
```json
{
  "name": "Premium Client-Facing",
  "style": "Glassmorphism",
  "palette": {
    "primary": "#2D3748",
    "secondary": "#3B82F6",
    "accent": "#10B981",
    "background": "#F9FAFB",
    "text": "#111827"
  },
  "typography": {
    "display": "Inter Tight",
    "body": "Inter",
    "google_fonts_url": "https://fonts.google.com/share?selection?family=Inter:wght@400;500;600;700|Inter+Tight:wght@600;700;800"
  },
  "tags": ["Client-facing", "Modern", "Professional"],
  "effects": ["Frosted glass cards", "Subtle shadows", "Smooth hover states (200ms)"]
}
```

## Phase 5: Interactive Edits

**Goal:** Apply guided edits to existing dashboard spec.

### Edit Request Patterns

See `references/edit-patterns.md` for complete edit workflow documentation.

**"Make it more premium":**
```bash
python3 search.py "luxury premium soft-ui gold" --domain style
python3 search.py "gold navy elegant refined" --domain color
python3 search.py "editorial serif luxury" --domain typography
```

Apply: Increase spacing, add layered shadows, refined typography, frosted glass effects

**"Make it more minimal":**
```bash
python3 search.py "minimalism swiss brutalism clean" --domain style
python3 search.py "monochrome neutral gray" --domain color
python3 search.py "geometric sans clean modern" --domain typography
```

Apply: Remove decorative elements, reduce colors to 2-3, increase whitespace, simplify typography

**"Make it more bold":**
```bash
python3 search.py "neubrutalism high-contrast dramatic" --domain style
python3 search.py "black white bright-accent" --domain color
```

Apply: Increase contrast, sharp corners, dramatic shadows, bolder fonts, thicker borders

**"Add dashboard charts":**
```bash
python3 search.py "call volume trends line-chart" --domain chart
python3 search.py "success rate gauge real-time" --domain chart
```

**"Fix accessibility":**
```bash
python3 search.py "contrast wcag keyboard-navigation" --domain ux
python3 search.py "reduced-motion animation" --domain ux
```

### Always Apply Frontend-Design Principles

**Search tells you WHAT** (industry conventions, proven patterns)  
**Frontend-Design tells you HOW** (make it distinctive, avoid AI slop)

Combine both for premium results.

## Platform-Specific Patterns

### Vapi (Call Centers)
**Tone:** Professional, reliable, real-time  
**Colors:** Blues, teals, neutrals (trust, communication)  
**Emphasis:** Live status, call volume trends, success rates  
**Avoid:** Overly playful, slow animations, tiny text

### n8n (Workflow Automation)
**Tone:** Technical, efficient, modular  
**Colors:** Purples (brand), oranges (energy), grays  
**Emphasis:** Flow diagrams, execution timelines, error tracking  
**Avoid:** Cluttered layouts, too much text

### Make (Automation Scenarios)
**Tone:** Clean, systematic, operational  
**Colors:** Greens, blues, whites (productivity, growth)  
**Emphasis:** Scenario summaries, operation counts, data flow  
**Avoid:** Abstract visualizations (keep concrete)

### Retell (Voice AI)
**Tone:** Conversational, human-centric, warm  
**Colors:** Warm neutrals, accent colors (approachable)  
**Emphasis:** Conversation quality, sentiment, transcripts  
**Avoid:** Cold/clinical aesthetics

## Story Type Patterns

### Performance Snapshot (Quick Glance)
- Hero metrics at top (2-3 big KPIs)
- 2-column grid below
- Generous whitespace
- Sticky header with filters

### Deep Analytics (Detailed Exploration)
- Side navigation or tabs
- Dense grid of charts (3-4 per row)
- Collapsible detail panels
- Inline filters
- Controlled density

### Impact Report (Executive Summary)
- Single column, narrative flow
- Big numbers with context
- Timeline or before/after
- Minimal chrome
- Print-friendly

## Anti-Patterns Database

**Banking/Fintech:**
- ❌ AI purple/pink gradients (too playful)
- ❌ Comic Sans, rounded fonts (unprofessional)
- ❌ Bright red/green for money (too aggressive)
- ✅ Blues, grays, subtle greens

**Healthcare:**
- ❌ Dark mode only (accessibility)
- ❌ Harsh red (anxiety-inducing)
- ❌ Complex animations (cognitive load)
- ✅ Calming blues/greens, high contrast text

**Call Centers (Vapi/Retell):**
- ❌ Slow-loading animations (real-time data)
- ❌ Overly playful (professional context)
- ❌ Tiny text (quick scanning needed)
- ✅ Clear status indicators, large readable fonts

## Pre-Delivery Checklist

Every design must validate against this checklist before delivery:

**Typography:**
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] Display + body font pairing (not single font)
- [ ] Font sizes: 16px+ body (client), 14px+ (ops)

**Interactivity:**
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with 150-300ms transitions
- [ ] Focus states visible for keyboard nav
- [ ] Touch targets 44x44px minimum (mobile)

**Accessibility:**
- [ ] Text contrast 4.5:1 minimum (WCAG AA)
- [ ] `prefers-reduced-motion` respected
- [ ] All interactive elements keyboard-accessible

**Responsive:**
- [ ] Breakpoints: 375px, 768px, 1024px, 1440px
- [ ] Mobile-first approach
- [ ] No horizontal scroll on mobile

**Performance:**
- [ ] Images optimized (WebP, lazy loading)
- [ ] CSS animations (not JS where possible)
- [ ] Minimal `backdrop-filter` (expensive)

## Workflow Summary

**Phase 3 (Style Bundle Generation):**
1. Run design system generator
2. Parse output (Pattern, Style, Colors, Typography, Effects, Anti-patterns)
3. Generate 4 bundle variations
4. Return formatted bundles to user

**Phase 5 (Interactive Edits):**
1. Identify edit type ("more premium", "more minimal", etc.)
2. Run domain searches for refinement
3. Apply changes via design token updates
4. Validate against checklist
5. Return updated spec

**Always:**
- Search first (BM25 for industry rules)
- Apply Frontend-Design principles (distinctiveness)
- Validate against checklist (quality)
- Cross-reference anti-patterns (avoid mistakes)
