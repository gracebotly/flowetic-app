
# UI/UX Pro Max Search Domains Reference

Complete documentation of the 7 searchable domains in UI/UX Pro Max BM25 system.

## Domain 1: Product (100 Categories)

**File:** `products.csv`  
**Purpose:** Product type matching with industry-specific reasoning rules  
**Search triggers:** Product names, industry keywords, use cases

### Product Categories by Industry

**Tech & SaaS:**
- SaaS Platform, Micro SaaS, B2B Enterprise Software
- Developer Tools, API Services, Cloud Platform
- AI/Chatbot Platform, Code Editor, DevOps Dashboard
- Analytics Platform, Monitoring Tools

**Finance:**
- Fintech App, Banking Platform, Cryptocurrency Exchange
- Investment Platform, Trading Dashboard, Payment Processing
- Budgeting App, Personal Finance, Wealth Management

**Healthcare:**
- Medical Clinic Portal, Telemedicine Platform, Pharmacy System
- Dental Practice Software, Veterinary Clinic, Mental Health App
- Wellness App, Fitness Tracker, Health Dashboard

**E-commerce:**
- Online Store, Marketplace, Luxury E-commerce
- Subscription Box, Fashion Store, Beauty Store
- Electronics Store, Grocery Delivery

**Services:**
- Beauty/Spa Booking, Restaurant Management, Hotel Booking
- Legal Services, Consulting Platform, Freelance Marketplace
- Real Estate Platform, Travel Agency, Event Management

**Creative:**
- Portfolio Website, Agency Website, Photography Portfolio
- Gaming Platform, Music Streaming, Video Platform
- Design Tools, Creative Agency, Content Management

**Emerging Tech:**
- Web3/NFT Platform, Spatial Computing, Blockchain App
- Quantum Computing, Autonomous Systems, IoT Dashboard

### Reasoning Rule Structure

Each product category includes:
- **Recommended Pattern** - Landing page structure
- **Style Priority** - Best matching UI styles
- **Color Mood** - Industry-appropriate palettes
- **Typography Mood** - Font personality matching
- **Key Effects** - Animations and interactions
- **Anti-Patterns** - What NOT to do

Example rule (Fintech):
```json
{
  "product_type": "Fintech App",
  "recommended_pattern": "Trust & Authority",
  "style_priority": "Minimalism, Glassmorphism, Soft UI Evolution",
  "color_mood": "Professional blues, grays, subtle greens",
  "typography_mood": "Modern sans-serif, clean, professional",
  "key_effects": "Subtle transitions, data visualization, security badges",
  "anti_patterns": ["AI purple/pink gradients", "Playful fonts", "Harsh red/green"]
}
```

---

## Domain 2: Style (67 Styles)

**File:** `styles.csv`  
**Purpose:** UI style definitions and recommendations  
**Search triggers:** Style names, aesthetic keywords, mood descriptors

### General Styles (49)

| Style | Keywords | Best For |
|-------|----------|----------|
| Minimalism & Swiss Style | Clean, simple, grid, whitespace | Enterprise apps, dashboards |
| Neumorphism | Soft shadows, subtle depth, 3D | Health/wellness, meditation |
| Glassmorphism | Frosted glass, translucent, blur | Modern SaaS, financial dashboards |
| Brutalism | Raw, bold, typography-heavy | Design portfolios, artistic |
| Claymorphism | Soft clay, rounded, playful | Educational apps, children's apps |
| Aurora UI | Gradient mesh, vibrant, modern | Creative agencies, SaaS |
| Dark Mode (OLED) | Black background, high contrast | Night-mode apps, coding |
| Flat Design | Simple, 2D, minimal shadows | Web apps, mobile apps |
| Soft UI Evolution | Soft shadows, subtle depth, calming | Enterprise apps, wellness |
| Neubrutalism | Bold, high contrast, sharp corners | Gen Z brands, startups |
| Bento Box Grid | Grid-based, card layout, modular | Dashboards, product pages |

### Landing Page Styles (8)

| Style | Keywords | Best For |
|-------|----------|----------|
| Hero-Centric Design | Large hero, visual identity | Products with strong visuals |
| Conversion-Optimized | CTA-focused, minimal distraction | Lead generation, sales |
| Feature-Rich Showcase | Multiple sections, detailed | SaaS, complex products |
| Minimal & Direct | Simple, direct, minimal text | Simple products, apps |
| Social Proof-Focused | Testimonials, reviews, trust | Services, B2C products |

### BI/Analytics Dashboard Styles (10)

| Style | Keywords | Best For |
|-------|----------|----------|
| Data-Dense Dashboard | Multiple charts, dense information | Complex data analysis |
| Executive Dashboard | High-level, summary, KPIs | C-suite summaries |
| Real-Time Monitoring | Live data, status indicators | Operations, DevOps |
| Financial Dashboard | Tables, trends, comparisons | Finance, accounting |

---

## Domain 3: Color (96 Palettes)

**File:** `colors.csv`  
**Purpose:** Industry-specific color palettes with HEX codes  
**Search triggers:** Color names, industry keywords, mood descriptors

### Industry Coverage

**Technology (15 palettes):**
- SaaS Blue (#3B82F6, #1E293B, #F9FAFB)
- Developer Tools Dark (#0F172A, #38BDF8, #10B981)
- Cloud Platform (#0EA5E9, #F0F9FF, #0C4A6E)
- API Services (#8B5CF6, #F5F3FF, #4C1D95)

**Finance (12 palettes):**
- Fintech Blue (#1E40AF, #DBEAFE, #1E3A8A)
- Banking Green (#059669, #D1FAE5, #065F46)
- Crypto Purple (#7C3AED, #EDE9FE, #5B21B6)
- Investment Gold (#D97706, #FEF3C7, #92400E)

**Healthcare (10 palettes):**
- Medical Blue (#0284C7, #E0F2FE, #075985)
- Wellness Green (#10B981, #D1FAE5, #047857)
- Mental Health Purple (#8B5CF6, #F5F3FF, #6D28D9)
- Pharmacy Teal (#14B8A6, #CCFBF1, #0F766E)

**E-commerce (12 palettes):**
- Retail Multi (#EF4444, #3B82F6, #FFFFFF)
- Luxury Gold (#B45309, #FEF3C7, #78350F)
- Fashion Pink (#EC4899, #FCE7F3, #9D174D)
- Beauty Spa (#E8B4B8, #A8D5BA, #D4AF37)

**Business (8 palettes):**
- Enterprise Navy (#1E3A8A, #DBEAFE, #1E40AF)
- Productivity Green (#059669, #D1FAE5, #047857)
- CRM Blue (#0284C7, #E0F2FE, #0369A1)
- Project Management (#6366F1, #E0E7FF, #4F46E5)

Each palette includes:
- Primary color (main brand)
- Secondary color (supporting)
- Accent color (CTAs, highlights)
- Background color (surface)
- Text color (primary text)

---

## Domain 4: Typography (56 Pairings)

**File:** `typography.csv`  
**Purpose:** Curated font pairings with Google Fonts links  
**Search triggers:** Font names, mood descriptors, aesthetic keywords

### Font Pairing Structure

Each pairing includes:
- **Display Font** (headings, hero text)
- **Body Font** (paragraphs, UI text)
- **Mood** (elegant, modern, playful, etc.)
- **Best For** (industry or use case)
- **Google Fonts URL** (ready to import)

### Categories

**Elegant & Refined (12 pairings):**
- Cormorant Garamond + Montserrat (luxury, wellness)
- Crimson Pro + Lato (editorial, premium)
- Playfair Display + Source Sans Pro (fashion, beauty)

**Modern & Geometric (15 pairings):**
- Space Grotesk + DM Sans (tech, startups)
- Inter Tight + Inter (SaaS, modern)
- Public Sans + Public Sans (government, clean)

**Professional & Corporate (10 pairings):**
- Roboto Condensed + Roboto (enterprise)
- Work Sans + Work Sans (business, corporate)
- IBM Plex Sans + IBM Plex Sans (tech, corporate)

**Creative & Distinctive (12 pairings):**
- Syne + Syne (bold, creative)
- Archivo Black + Archivo (strong, impactful)
- Bebas Neue + Open Sans (modern, bold)

**Friendly & Approachable (7 pairings):**
- Nunito + Nunito (education, friendly)
- Quicksand + Quicksand (playful, children)
- Comfortaa + Comfortaa (soft, welcoming)

---

## Domain 5: Landing (24 Patterns)

**File:** `landing-pages.csv`  
**Purpose:** Landing page structure patterns  
**Search triggers:** Pattern names, conversion goals, page types

### Page Patterns

**Hero-Centric Patterns (6):**
- Hero + Features + CTA
- Hero + Social Proof + Features
- Hero + Video Demo + CTA
- Hero + Product Showcase + Pricing

**Conversion-Focused Patterns (6):**
- Minimal One-Page + CTA
- Lead Capture + Benefits
- Pricing-First + Features
- Free Trial + Trust Signals

**Feature-Rich Patterns (6):**
- Multi-Section Showcase
- Tabbed Features + Demos
- Timeline Storytelling
- Case Study + Features

**Trust & Authority Patterns (6):**
- Client Logos + Testimonials
- Certifications + Case Studies
- Expert Team + Process
- Industry Awards + Press

---

## Domain 6: Chart (25 Types)

**File:** `charts.csv`  
**Purpose:** Chart type recommendations for dashboard data  
**Search triggers:** Data type, visualization goals, metric names

### Chart Categories

**Comparison (5 types):**
- Bar Chart - Compare categories
- Column Chart - Compare over time
- Grouped Bar - Multiple series comparison
- Stacked Bar - Part-to-whole comparison
- Radar Chart - Multi-dimensional comparison

**Trend (5 types):**
- Line Chart - Show trends over time
- Area Chart - Cumulative trends
- Sparkline - Compact trend indicator
- Candlestick - Financial OHLC data
- Step Chart - Discrete value changes

**Distribution (5 types):**
- Histogram - Frequency distribution
- Box Plot - Statistical distribution
- Scatter Plot - Correlation/clusters
- Bubble Chart - 3-dimensional scatter
- Heatmap - Matrix correlation

**Part-to-Whole (5 types):**
- Pie Chart - Simple proportions
- Donut Chart - Proportions with center text
- Treemap - Hierarchical proportions
- Sunburst - Multi-level hierarchy
- Stacked Area - Cumulative proportions

**Real-Time (5 types):**
- Gauge - Single metric status
- Progress Bar - Completion percentage
- Number Card - KPI display
- Status Indicator - Live status
- Activity Feed - Recent events

---

## Domain 7: UX (98 Guidelines)

**File:** `ux-guidelines.csv`  
**Purpose:** UX best practices and anti-patterns  
**Search triggers:** UX topics, accessibility keywords, interaction types

### Guideline Categories

**Accessibility (20 guidelines):**
- WCAG AA contrast ratios (4.5:1 text, 3:1 UI)
- Keyboard navigation (all interactive elements)
- Screen reader support (ARIA labels)
- Focus indicators (visible, 2px outline)
- Touch targets (44x44px minimum)
- Color blindness consideration (not color alone)
- Reduced motion respect (`prefers-reduced-motion`)

**Animation (15 guidelines):**
- Transition timing (150-300ms for micro, 300-500ms for page)
- Easing functions (ease-out for enter, ease-in for exit)
- Stagger delays (50-100ms between items)
- Performance (CSS transforms, avoid layout shifts)
- Purpose (functional, not decorative)

**Typography (12 guidelines):**
- Font sizes (16px+ body, 14px+ small)
- Line height (1.5-1.7 for body text)
- Line length (50-75 characters optimal)
- Hierarchy (3-5 distinct sizes)
- Spacing (letter-spacing for uppercase)

**Layout (15 guidelines):**
- Responsive breakpoints (375px, 768px, 1024px, 1440px)
- Grid systems (12-column, 8-point spacing)
- Whitespace (generous for premium, controlled for dense)
- Visual hierarchy (size, weight, color, position)
- F-pattern reading (important left-top)

**Forms (12 guidelines):**
- Label placement (top-aligned, not placeholder)
- Input validation (inline, real-time when helpful)
- Error messages (specific, actionable)
- Required fields (clear indicators)
- Auto-complete (enable when appropriate)

**Mobile (12 guidelines):**
- Touch targets (44x44px minimum)
- Thumb zones (bottom 1/3 screen for primary actions)
- Gesture support (swipe, pinch, long-press)
- Viewport meta tag (responsive scaling)
- Loading states (skeleton screens)

**Performance (12 guidelines):**
- Image optimization (WebP, lazy loading)
- Code splitting (route-based chunks)
- Critical CSS (inline above-fold)
- Font loading (swap or optional)
- Animation performance (transform, opacity only)

---

## Search Best Practices

### Query Formation

**Specific is better than generic:**
- ❌ "dashboard colors"
- ✅ "fintech dashboard blue professional"

**Combine domain + context:**
- ❌ "elegant fonts"
- ✅ "elegant luxury serif editorial" (typography domain)

**Use industry keywords:**
- ✅ "vapi call center real-time monitoring" (product + style)
- ✅ "healthcare calming blue accessibility" (color + ux)

### Multi-Domain Searches

For comprehensive guidance, search multiple domains:

1. **Product domain** - Get reasoning rules
2. **Style domain** - Get aesthetic direction
3. **Color domain** - Get palette recommendations
4. **Typography domain** - Get font pairings
5. **UX domain** - Validate accessibility

### Result Interpretation

**BM25 Score Interpretation:**
- 8.0+ - Highly relevant, strong match
- 6.0-7.9 - Relevant, good match
- 4.0-5.9 - Moderately relevant
- < 4.0 - Weak match, consider different keywords

**When to Search Again:**
- Initial results score < 6.0
- Need alternative options
- Validating against anti-patterns
- User requests refinement
