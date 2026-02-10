---
name: ui-ux-pro-max
description: "UI/UX design intelligence. 50 styles, 21 palettes, 50 font pairings, 20 charts, 9 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, mobile app, .html, .tsx, .vue, .svelte. Elements: button, modal, navbar, sidebar, card, table, form, chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, flat design. Topics: color palette, accessibility, animation, layout, typography, font pairing, spacing, hover, shadow, gradient. Integrations: shadcn/ui MCP for component search and examples."
---

# UI/UX Pro Max Skill

## Overview
This skill provides access to a comprehensive design database via native Mastra tools.
All design recommendations MUST come from tool queries - never from LLM memory.

## Available Tools

### getStyleRecommendations
Search 67+ UI styles by product type, industry, and keywords.

**Query examples:**
- "fintech dashboard minimal"
- "healthcare monitoring dark"
- "startup saas bold"
- "enterprise corporate professional"
- "voice ai cyber glass"

**Returns:** Style category, colors (hex), effects, complexity rating, implementation checklist.

### getTypographyRecommendations
Search 57+ font pairings by style, mood, and use case.

**Query examples:**
- "professional corporate"
- "modern tech startup"
- "friendly approachable"
- "premium luxury"

**Returns:** Font pairings (heading + body), weights, line heights, use cases.

### getChartRecommendations
Search 25+ chart types by data pattern and visualization goal.

**Query examples:**
- "time series trend"
- "comparison categories"
- "part-to-whole percentage"
- "geographic distribution"

**Returns:** Chart type, secondary options, color guidance, accessibility notes, library recommendations.

### getProductRecommendations
Search industry-specific design patterns.

**Query examples:**
- "crm dashboard"
- "voice ai analytics"
- "workflow automation"
- "healthcare monitoring"

**Returns:** Primary style recommendation, landing page pattern, dashboard style, key considerations.

### getUXGuidelines
Search 98+ UX best practices by category and platform.

**Query examples:**
- "mobile navigation"
- "form validation"
- "accessibility wcag"
- "dashboard layout"

**Returns:** Guideline, do/don't examples, code samples, severity rating.

## Usage Rules

1. **ALWAYS** call tools before giving design advice
2. **NEVER** invent design values - use only what tools return
3. Reference specific values from results (hex codes, font names, style names)
4. If tools return empty, suggest broadening the query
5. Combine multiple tool results for comprehensive recommendations

## Data Sources
- styles.csv: 67 UI styles with colors, effects, complexity
- typography.csv: 57 font pairings with weights, use cases
- charts.csv: 25 chart types with accessibility notes
- products.csv: Industry-specific design patterns
- ux-guidelines.csv: 98 UX best practices
