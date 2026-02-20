# Chart Configuration Patterns
Detailed chart configuration guidance for each chart type used in Getflowetic dashboards. The SKILL.md tells you which chart to pick; this file tells you how to configure it properly.
---
## TimeseriesChart Configuration
### Axis Labels
- X-axis: Formatted dates based on interval (e.g., "Mon", "Jan 15", "Week 3", "January")
- Y-axis: Metric name with unit (e.g., "Executions", "Duration (ms)", "Cost ($)")
- Y-axis should start at 0 unless all values are in a narrow high range (e.g., success rate 90-100%)
### Line vs Area
- Single metric → Line chart (cleaner)
- Comparing success vs failure over time → Stacked area (shows total + breakdown)
- Multiple independent metrics → Multi-line (distinct colors, legend)
### Sparse Data Handling
- < 5 data points: Use scatter dots, not connected lines
- 5-10 data points: Connected line with visible dots at each point
- 10+ data points: Smooth line, dots optional
### Responsive Sizing
- Full width in all dashboard layouts
- Minimum height: 200px
- Preferred height: 300px
- On mobile: Stack charts vertically, maintain full width
---
## PieChart / DonutChart Configuration
### When to Use PieChart vs DonutChart
- PieChart: When there are exactly 2-3 categories (clean visual)
- DonutChart: When there are 4-6 categories (center space for total label)
- Beyond 6 categories: Switch to BarChart
### Color Assignment
Colors should come from the design token system (via STYLE_BUNDLE_TOKENS), but follow this priority:
1. Success/positive states → Green family
2. Error/negative states → Red family
3. Warning/pending states → Amber/yellow family
4. Neutral/other states → Gray or brand accent
### Label Formatting
- Show percentage + count: "Success: 73% (89)"
- Don't show slices smaller than 3% as separate — group into "Other"
- Center label (DonutChart only): Show the total count
### Legend
- Position: Below the chart on mobile, right side on desktop
- Show color swatch + category name + count
- Sort by count descending
---
## BarChart Configuration
### Orientation
- Vertical bars: When comparing 3-8 categories with short labels
- Horizontal bars: When labels are long (workflow names, error messages) or > 8 categories
### Top-N Filtering
When there are many categories, show only the top N by count:
- Default: Top 10
- If < 10 categories: Show all
- Always include an "Other" bar combining the remaining items
### Bar Labels
- Show value at the end of each bar (or on top for vertical)
- Use abbreviated numbers for large values: 1.2K, 3.4M
- Sort bars by value descending (largest at top/left)
### Responsive Sizing
- Half width on desktop (paired with PieChart)
- Full width on mobile
- Minimum height: 200px
---
## DataTable Configuration
### Default Columns
Show 4-6 columns maximum. Too many columns make tables hard to scan. Priority order:
1. Name/label field (what the record is)
2. Status field (with color badge)
3. Timestamp field (formatted relative: "2 hours ago")
4. Duration or cost field (if present)
5. ID field (truncated, for reference)
### Sorting
- Default sort: Timestamp descending (most recent first)
- Allow column header click to re-sort
### Row Limit
- Show 10-20 rows by default
- "Show more" link at bottom for pagination
- Never show > 50 rows in initial view
### Cell Formatting
| Data Type | Format | Example |
|---|---|---|
| Timestamp | Relative for < 24h, date for older | "2 hours ago", "Jan 15, 2025" |
| Duration | Smart unit conversion | "4.2s", "2m 15s", "1h 23m" |
| Money | Currency with 2 decimals | "$42.50" |
| Status | Colored badge/pill | 🟢 Success, 🔴 Failed |
| Long text | Truncated at 80 chars with ellipsis | "Error in webhook node when..." |
| UUID | First 8 characters | "a1b2c3d4..." |
---
## MetricCard Configuration
### Value Formatting
| Type | Format | Example |
|---|---|---|
| Count | Comma-separated, no decimals | "1,247" |
| Percentage | 1 decimal place + % | "94.2%" |
| Duration | Smart unit (ms → s → m → h) | "4.2s", "2m 15s" |
| Currency | $ + comma + 2 decimals | "$4,231.50" |
| Large numbers | Abbreviated with suffix | "1.2K", "3.4M" |
### Trend Indicator
- Show ▲ or ▼ with percentage change
- Color: Green for positive change (or negative on inverted metrics)
- Comparison period: Previous 7 days by default
- If insufficient historical data: Show "—" instead of trend
### Card Sizing
- Standard: 1/4 width (4 cards per row)
- Hero: Can be 1/3 width with larger font
- Minimum card width: 150px
- On mobile: 2 cards per row (2x2 grid)
---
## Color Palette Guidelines
While specific colors come from the selected style bundle, the *semantic meaning* of colors should be consistent:
| Semantic | Color Family | Usage |
|---|---|---|
| Success / Positive | Green | Success status, positive trends, good metrics |
| Error / Negative | Red | Failed status, errors, negative trends |
| Warning / Pending | Amber/Yellow | Pending, waiting, needs attention |
| Info / Neutral | Blue | Informational, active, in-progress |
| Muted / Inactive | Gray | Disabled, N/A, no data |
These semantic assignments override the style bundle's accent colors when displaying status-related data. A "midnight blue" style bundle still uses green for success and red for errors.
