

# Interactive Edit Patterns Reference

Complete documentation for Phase 5 interactive edit workflows.

## Edit Request Categories

### 1. Premium Refinement

**User request:** "Make it more premium", "More luxurious", "More sophisticated"

**Search Pattern:**
```bash
python3 search.py "luxury premium soft-ui gold refined" --domain style
python3 search.py "gold navy elegant sophisticated" --domain color
python3 search.py "editorial serif luxury garamond" --domain typography
```

**Design Token Changes:**

**Spacing:**
```json
{
  "spacing": {
    "cardPadding": "24px",  // increased from 16px
    "sectionGap": "64px",   // increased from 48px
    "contentMaxWidth": "1200px"  // wider for breathing room
  }
}
```

**Shadows:**
```json
{
  "shadows": {
    "card": "0 1px 3px rgba(0,0,0,0.05), 0 10px 20px rgba(0,0,0,0.05), 0 20px 40px rgba(0,0,0,0.02)",
    "cardHover": "0 4px 6px rgba(0,0,0,0.05), 0 20px 30px rgba(0,0,0,0.08)"
  }
}
```

**Typography:**
```json
{
  "typography": {
    "fontFamily": {
      "display": "Crimson Pro",
      "body": "Lato"
    },
    "letterSpacing": {
      "label": "0.05em",  // increased for refined look
      "heading": "-0.02em"
    }
  }
}
```

**Colors:**
```json
{
  "colors": {
    "surface": "linear-gradient(135deg, #FFFFFF 0%, #F9FAFB 100%)",
    "accent": "#D4AF37"  // gold accent
  }
}
```

**Effects:**
- Add frosted glass effects (`backdrop-filter: blur(10px)`)
- Subtle gradient backgrounds
- Increased border-radius (8-12px)
- Refined hover states (gentle lift, subtle glow)

---

### 2. Minimal Simplification

**User request:** "Make it more minimal", "Simpler", "Cleaner", "Less clutter"

**Search Pattern:**
```bash
python3 search.py "minimalism swiss brutalism clean geometric" --domain style
python3 search.py "monochrome neutral gray black white" --domain color
python3 search.py "geometric sans clean modern helvetica" --domain typography
```

**Design Token Changes:**

**Colors:**
```json
{
  "colors": {
    "primary": "#111827",
    "secondary": "#6B7280",
    "accent": "#3B82F6",  // single accent color
    "background": "#FFFFFF",
    "surface": "#F9FAFB"
  }
}
```

**Typography:**
```json
{
  "typography": {
    "fontFamily": {
      "display": "Public Sans",
      "body": "Public Sans"  // single font family
    },
    "fontWeight": {
      "normal": 400,
      "medium": 500,
      "bold": 600  // reduced weight variation
    }
  }
}
```

**Spacing:**
```json
{
  "spacing": {
    "cardPadding": "32px",  // generous whitespace
    "sectionGap": "96px",   // large gaps
    "elementGap": "24px"
  }
}
```

**Shadows:**
```json
{
  "shadows": {
    "card": "0 1px 2px rgba(0,0,0,0.05)"  // subtle or none
  }
}
```

**Effects:**
- Remove decorative elements
- Remove gradients (solid colors only)
- Remove or simplify icons
- Flat design (minimal depth)
- Simple hover states (opacity or subtle underline)

---

### 3. Bold Enhancement

**User request:** "Make it more bold", "More dramatic", "More striking", "More impact"

**Search Pattern:**
```bash
python3 search.py "neubrutalism high-contrast dramatic bold" --domain style
python3 search.py "black white bright-accent red yellow" --domain color
python3 search.py "display bold geometric heavy impact" --domain typography
```

**Design Token Changes:**

**Colors:**
```json
{
  "colors": {
    "primary": "#000000",
    "secondary": "#FFFFFF",
    "accent": "#EF4444",  // bright accent
    "text": {
      "primary": "#000000",
      "onDark": "#FFFFFF"
    }
  }
}
```

**Typography:**
```json
{
  "typography": {
    "fontFamily": {
      "display": "Archivo Black",
      "body": "Archivo"
    },
    "fontWeight": {
      "heading": 900,
      "subheading": 700,
      "body": 500
    },
    "fontSize": {
      "display": "4rem",  // larger headings
      "h1": "3rem"
    }
  }
}
```

**Borders:**
```json
{
  "borders": {
    "width": "3px",  // thicker borders
    "radius": "0px",  // sharp corners
    "color": "#000000"
  }
}
```

**Shadows:**
```json
{
  "shadows": {
    "card": "8px 8px 0 #000000",  // dramatic hard shadow
    "cardHover": "12px 12px 0 #000000"
  }
}
```

**Effects:**
- Sharp corners (border-radius: 0)
- High contrast (black/white with bright accents)
- Thick borders (2-4px)
- Dramatic shadows (hard drop shadows)
- Bold typography (heavy weights)

---

### 4. Dark Mode Conversion

**User request:** "Make it dark mode", "Dark theme", "OLED black"

**Search Pattern:**
```bash
python3 search.py "dark-mode oled black high-contrast" --domain style
python3 search.py "dark charcoal slate black" --domain color
```

**Design Token Changes:**

**Colors:**
```json
{
  "colors": {
    "background": "#0F172A",  // dark blue-gray
    "surface": "#1E293B",
    "surfaceElevated": "#334155",
    "primary": "#3B82F6",
    "accent": "#10B981",
    "text": {
      "primary": "#F1F5F9",
      "secondary": "#94A3B8",
      "tertiary": "#64748B"
    },
    "border": "#334155"
  }
}
```

**Contrast Adjustments:**
```json
{
  "shadows": {
    "card": "0 4px 6px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3)"
  },
  "opacity": {
    "disabled": 0.4,  // increased for visibility
    "hover": 0.9
  }
}
```

**Effects:**
- Ensure 4.5:1 contrast for text
- Use elevated surfaces (lighter than background)
- Adjust shadows (darker, more prominent)
- Reduce bright accent intensity

---

### 5. Density Adjustment

**User request:** "More compact", "More spacious", "Tighter layout", "More breathing room"

**Compact (Operational/Internal):**
```json
{
  "spacing": {
    "unit": 4,
    "cardPadding": "12px",
    "sectionGap": "32px",
    "elementGap": "8px"
  },
  "typography": {
    "fontSize": {
      "body": "14px",
      "small": "12px"
    },
    "lineHeight": {
      "body": 1.4
    }
  }
}
```

**Spacious (Client-Facing/Premium):**
```json
{
  "spacing": {
    "unit": 8,
    "cardPadding": "32px",
    "sectionGap": "96px",
    "elementGap": "24px"
  },
  "typography": {
    "fontSize": {
      "body": "18px",
      "small": "16px"
    },
    "lineHeight": {
      "body": 1.7
    }
  }
}
```

---

### 6. Client Report Conversion

**User request:** "Make it a client report", "Executive summary style", "Print-friendly"

**Search Pattern:**
```bash
python3 search.py "executive-dashboard report summary clean" --domain style
python3 search.py "editorial magazine print layout" --domain landing
```

**Design Token Changes:**

**Layout:**
```json
{
  "layout": {
    "columns": 1,  // single column
    "maxWidth": "800px",
    "sectionGap": "64px"
  }
}
```

**Typography:**
```json
{
  "typography": {
    "fontFamily": {
      "display": "Crimson Pro",
      "body": "Lora"  // serif for readability
    },
    "fontSize": {
      "body": "18px",  // larger for reading
      "h1": "3rem",
      "h2": "2rem"
    },
    "lineHeight": {
      "body": 1.7  // generous line height
    }
  }
}
```

**Colors:**
```json
{
  "colors": {
    "background": "#FFFFFF",
    "text": {
      "primary": "#1A1A1A"  // dark for print
    }
  }
}
```

**Effects:**
- Remove interactive elements (minimal buttons)
- Add explanatory text/context
- Large typography for readability
- Minimize chrome (hide navigation, filters)
- Print-friendly colors (no dark backgrounds)
- Add page breaks for sections

---

### 7. Internal Ops Console

**User request:** "Make it for operations team", "Internal dashboard", "Power user interface"

**Search Pattern:**
```bash
python3 search.py "data-dense operational technical" --domain style
python3 search.py "dashboard real-time monitoring charts" --domain chart
```

**Design Token Changes:**

**Density:**
```json
{
  "spacing": {
    "cardPadding": "16px",
    "sectionGap": "24px",
    "elementGap": "12px"
  }
}
```

**Typography:**
```json
{
  "typography": {
    "fontFamily": {
      "display": "Inter",
      "body": "Inter",
      "mono": "Fira Code"  // for technical data
    },
    "fontSize": {
      "body": "14px",
      "small": "12px"
    }
  }
}
```

**Features to Add:**
- More filters and controls
- Technical terminology (not simplified)
- Dense data tables
- Real-time indicators
- Customization options (rearrange, hide/show)
- Keyboard shortcuts
- Export functionality

---

## Edit Workflow Template

**Step 1: Identify Edit Category**
```
Premium | Minimal | Bold | Dark | Density | Client Report | Internal Ops
```

**Step 2: Run Searches**
```bash
# Style search
python3 search.py "{category_keywords}" --domain style

# Color search (if needed)
python3 search.py "{color_keywords}" --domain color

# Typography search (if needed)
python3 search.py "{typography_keywords}" --domain typography

# UX validation
python3 search.py "{accessibility_keywords}" --domain ux
```

**Step 3: Parse Search Results**
```json
{
  "style": {
    "name": "...",
    "keywords": "...",
    "guidelines": "..."
  },
  "colors": {
    "palette": {...}
  },
  "typography": {
    "display": "...",
    "body": "..."
  }
}
```

**Step 4: Generate Design Token Patch**
```json
{
  "designTokens": {
    "colors": {...},
    "typography": {...},
    "spacing": {...},
    "shadows": {...},
    "borders": {...}
  }
}
```

**Step 5: Apply via applySpecPatch Tool**
```typescript
await applySpecPatch({
  specId: currentSpecId,
  patch: designTokenPatch,
  validateAfter: true
});
```

**Step 6: Validate Against Checklist**
```markdown
- [ ] Contrast ratios meet WCAG AA
- [ ] Typography hierarchy maintained
- [ ] Spacing system consistent
- [ ] Hover states preserved
- [ ] Responsive breakpoints work
```

---

## Common Edit Combinations

**Premium + Dark:**
```bash
python3 search.py "luxury dark sophisticated" --domain style
python3 search.py "dark gold elegant refined" --domain color
```

**Minimal + Bold:**
```bash
python3 search.py "brutalism minimal clean sharp" --domain style
python3 search.py "black white monochrome high-contrast" --domain color
```

**Client Report + Premium:**
```bash
python3 search.py "editorial luxury refined sophisticated" --domain style
python3 search.py "serif elegant editorial luxury" --domain typography
```

---

## Validation After Edits

**Always re-check:**
1. Text contrast ratios (4.5:1 minimum)
2. Hover states still functional
3. Responsive layout not broken
4. Accessibility preserved
5. Performance not degraded

**Run UX search for validation:**
```bash
python3 search.py "contrast accessibility wcag" --domain ux
python3 search.py "responsive mobile breakpoints" --domain ux
python3 search.py "reduced-motion animation" --domain ux
```


