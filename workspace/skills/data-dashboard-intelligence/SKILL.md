---
name: data-dashboard-intelligence
description: Universal intelligence for turning normalized event data into premium, story-driven dashboards. Covers field-to-component mapping, aggregation selection, dashboard story structure, hero stat detection, and graceful degradation. Use this skill whenever generating a dashboard spec, editing dashboard components, choosing chart types, deciding aggregation methods, handling empty or sparse data, writing component headlines, ordering components on a dashboard, or picking which metric should be the hero stat. Even if the user doesn't say "dashboard intelligence", use this skill for ANY dashboard generation or editing task.
tags:
  - dashboard
  - visualization
  - data-mapping
  - storytelling
  - universal
lastUpdated: 2025-02-19
---
# Data Dashboard Intelligence
This skill teaches you how to turn normalized event data into dashboards that look and feel premium — not generic template outputs. It works on **field semantics** (what the data looks like), not platform names (where it came from). By the time you use this skill, platform skills have already normalized fields into universal types like `status`, `duration_ms`, `cost`, and `timestamp`.
The core idea is simple: every field in a dataset has a *shape* (numeric, categorical, temporal, textual) and a *semantic* (it measures time, money, status, identity, etc.). The shape tells you which component to use. The semantic tells you how to aggregate it and what to call it. Together, they produce a dashboard that tells a story instead of just displaying numbers.
---
## 1. Field-to-Component Mapping
When you see a field from `getEventSamples` or `analyzeSchema`, pick the right component based on what the field *is*, not what it's named.
| Field Shape | How to Detect | Component | Why This Works |
|---|---|---|---|
| **ID** (unique, high cardinality) | `uniqueValues / totalRows > 0.9` | MetricCard (`count`) | IDs exist to be counted — "Total Executions" |
| **Status** (categorical, 2–8 values) | String, `uniqueValues` 2–8 | PieChart / DonutChart | People intuitively read status distributions as pie slices |
| **Binary** (exactly 2 values) | `uniqueValues === 2`, one is positive | MetricCard (`percentage`) | Success/fail is best shown as "94% Success Rate" |
| **Timestamp** (datetime) | Parseable as date, sequential | TimeseriesChart | Trends over time need a time axis |
| **Duration** (numeric, positive) | Name contains `duration`, `time`, `elapsed`, `ms` | MetricCard (`average`) | Average duration is more useful than total |
| **Money** (numeric, currency-like) | Name contains `cost`, `amount`, `price`, `spend` | MetricCard (`sum`) + trend | You sum money — "Total Spend: $4,200" |
| **Rate** (numeric, 0–100 or 0–1) | Name contains `rate`, `ratio`, `percent`, `score` | MetricCard (`average`) | Rates are averaged or shown as latest |
| **Label** (medium cardinality, 3–50 values) | String, `uniqueValues` 3–50 | BarChart | Bar charts handle medium-cardinality breakdowns well |
| **High-cardinality text** (>50 values) | String, `uniqueValues > 50` | DataTable column | Too many values for any chart — show in table |
| **Long text** (avg length > 100 chars) | String, `avg(length) > 100` | DataTable column (truncated) | Transcripts, error messages — table only |
**Override rules** (these exist because edge cases produce ugly charts):
- Timestamp with < 5 distinct dates → MetricCard fallback (sparse timeseries look broken)
- Categorical with exactly 1 unique value → skip entirely (no information content)
- Numeric with identical values in every row → static MetricCard with "Constant value" note
- Categorical with > 6 values → BarChart, never PieChart (pie charts become unreadable past 6 slices)
---
## 2. Aggregation Selection
The reason aggregation matters is that the same field can tell completely different stories depending on whether you count it, average it, or sum it. Getting this wrong produces dashboards that say "Total Duration: 847,291ms" instead of "Avg Duration: 4.2s" — technically correct but useless.
| Field Semantic | Aggregation | Reasoning |
|---|---|---|
| IDs (execution_id, call_id) | `count` | You're counting how many things happened |
| Duration (duration_ms, runtime) | `average` | "Avg call: 45s" is useful; "Total: 847,291ms" is not |
| Cost/Revenue (cost_usd, amount) | `sum` | Money gets summed — "Total Spend: $4,200" |
| Status categories | `count per category` | Distribution: "73 success, 12 failed, 3 running" |
| Binary success/fail | `percentage` | "94.2% Success Rate" — single number, maximum clarity |
| Scores/Ratings (nps, satisfaction) | `average` | Mean score is the universal standard |
| Timestamps | `count per interval` | Volume over time — "142 calls on Monday, 89 on Tuesday" |
**Time interval selection**: Match the interval to the data's timespan. Under 24 hours → hourly. 1–7 days → daily. 7–30 days → daily. 30–90 days → weekly. Over 90 days → monthly. The goal is 7–30 data points on the x-axis — fewer looks sparse, more looks noisy.
---
## 3. Dashboard Story Structure
Premium dashboards tell a story in layers. Users scan in an F-pattern (top-left → across → down-left → across), so the most important information goes top-left and the detail goes bottom.
### The One-Page Dashboard Story
```
Row 1: THE HEADLINE (Hero Stat) + Supporting KPI Cards (3-4 cards)
        → User knows "are things good or bad?" in 2 seconds
Row 2: THE TREND (TimeseriesChart, full width)
        → User sees direction over time in 5 seconds
Row 3: THE BREAKDOWN (BarChart left + PieChart right, half width each)
        → User sees what's driving the numbers in 10 seconds
Row 4: THE DETAILS (DataTable, full width)
        → User investigates specific records in 30+ seconds
```
This is the **progressive reveal** principle from data storytelling: start with the conclusion (hero stat), show the evidence (charts), then provide the raw material (table). Never put the table first — it forces users to do the analysis themselves instead of giving them the answer.
### Component Ordering
| Priority | Component | Position | Width | Reasoning |
|---|---|---|---|---|
| 1 | Hero MetricCard | Row 1, position 1 | 1/4 | First thing users see |
| 2 | Supporting MetricCards | Row 1, positions 2-4 | 1/4 each | Supporting context |
| 3 | TimeseriesChart | Row 2 | Full width | Trends need horizontal space |
| 4 | BarChart | Row 3, left | 1/2 | Top-N breakdown |
| 5 | PieChart/DonutChart | Row 3, right | 1/2 | Category distribution |
| 6 | DataTable | Row 4 | Full width | Detail records at bottom |
---
## 4. Hero Stat Selection
The hero stat is the single number that anchors the entire dashboard. It should be the first thing a user reads and immediately tell them whether things are going well. Choose it based on the domain, which you detect from the field names — not the platform name.
| Domain Signal | Hero Stat | Display | Detection Fields |
|---|---|---|---|
| Voice | Total Calls | "1,247 Calls" | `call`, `transcript`, `voice`, `dial` |
| Workflow | Success Rate | "94.2% Success" | `execution`, `workflow`, `node`, `trigger` |
| Chat | Active Conversations | "342 Active" | `message`, `conversation`, `session`, `chat` |
| Support | Avg Resolution Time | "2.4 hours" | `ticket`, `issue`, `resolution`, `sla` |
| Revenue | Total Revenue | "$12,450" | `revenue`, `invoice`, `payment`, `mrr` |
| Generic | Total Events | "3,891 Events" | Fallback when no domain detected |
If multiple domains match, count matching fields and use the domain with more matches. The reason voice leads with volume while workflow leads with success rate is that agency clients care about different things: voice clients want to know "how many calls did my bot handle?" while workflow clients want to know "is my automation reliable?"
For detailed KPI row patterns per domain, see `references/kpi-patterns.md`.
---
## 5. Data Quality and Graceful Degradation
The most common failure mode for AI-generated dashboards is showing broken charts when data is sparse or missing. This section prevents that by teaching you to assess what you have before deciding what to show.
### Minimum Data Thresholds
| Row Count | What to Show | Why |
|---|---|---|
| **0 rows** | Styled empty state with platform icon + "Waiting for first events..." | Blank dashboards feel broken; styled empty states feel intentional |
| **1–4 rows** | MetricCards with real values. Charts show "Need more data for trends." | Cards work with any count; charts need density |
| **5–19 rows** | All components. TimeseriesChart uses scatter dots, not lines. | Lines between 5 points look jagged; dots look intentional |
| **20–99 rows** | Full dashboard. Note small sample in tooltips. | All chart types work; note the limitation honestly |
| **100+ rows** | Premium dashboard. All features enabled. | Statistical aggregations are reliable |
### Fallback Chains
When a primary component can't render well, fall back to simpler alternatives instead of showing a broken chart:
- TimeseriesChart → BarChart (grouped by date) → MetricCard (total count)
- PieChart → horizontal BarChart → MetricCard (dominant category %)
- BarChart → DataTable (sorted by count) → MetricCard (unique count)
### Field-Level Degradation
| Scenario | What to Do | What NOT to Do |
|---|---|---|
| Field exists but all null | Hide component, show "—" in table | Show chart with "null" labels |
| PieChart with 1 category | Show MetricCard: "All records are [value]" | Show full circle in one color |
| Duration field all zeros | Show info card: "Duration tracking not configured" | Show "Avg: 0ms" |
| Cost field not present | Skip cost components entirely | Invent a cost column |
---
## 6. Component Headlines
Every component needs a title that a non-technical person can understand. The reason this matters is that agency clients show these dashboards to *their* clients — a label that says "execution_id COUNT" makes the agency look amateur.
### Formulas
| Component | Formula | Example |
|---|---|---|
| MetricCard (count) | "Total [Entity Plural]" | "Total Executions" |
| MetricCard (rate) | "[Entity] Success Rate" | "Call Success Rate" |
| MetricCard (avg) | "Avg [Entity] [Metric]" | "Avg Call Duration" |
| MetricCard (sum) | "Total [Money Type]" | "Total Spend" |
| TimeseriesChart | "[Entity Plural] Over Time" | "Executions Over Time" |
| BarChart | "Top [N] [Grouping]" | "Top 10 Workflows" |
| PieChart | "[Entity] by [Category]" | "Calls by Status" |
| DataTable | "Recent [Entity Plural]" | "Recent Executions" |
### Vocabulary Normalization
When writing titles, translate platform-internal terms into universal dashboard language. This keeps dashboards clean regardless of source platform:
| Platform Term | Universal Term |
|---|---|
| n8n "execution" / Make "operation" | "Run" or "Execution" |
| n8n "workflow" / Make "scenario" | "Workflow" or "Automation" |
| Vapi/Retell "assistant" | "Agent" |
| Any platform "event" | Use the entity name from user's selection |
Never use raw field names as titles. Never use technical aggregation syntax. Never include platform names in client-facing labels.
---
## 7. Chart Type Decision Tree
When choosing between chart types, follow this logic:
```
What kind of data?
├─ Categorical (string, enum)?
│  ├─ 2–6 unique values → PieChart / DonutChart
│  ├─ 7–15 values → horizontal BarChart
│  └─ 16+ values → DataTable (too many for any chart)
│
├─ Temporal (datetime)?
│  ├─ ≥ 5 data points → TimeseriesChart (line)
│  └─ < 5 data points → BarChart by date or MetricCard fallback
│
├─ Numeric (continuous)?
│  ├─ Comparing across categories → vertical BarChart
│  ├─ Single summary value → MetricCard
│  └─ Distribution → BarChart with ranges
│
└─ No good match → DataTable column
```
For detailed chart configuration patterns (axis labels, color assignments, responsive sizing), see `references/chart-patterns.md`.
---
## References
These files provide domain-specific depth when needed. Read them when the SKILL.md guidance isn't specific enough for the task at hand.
| Reference | When to Read | Contents |
|---|---|---|
| `references/kpi-patterns.md` | Building KPI rows for specific domains | Voice, Workflow, Chat, Support, Revenue KPI row patterns with exact metrics and aggregations |
| `references/chart-patterns.md` | Configuring chart properties | Axis labels, color assignment, responsive sizing, animation, tooltip formatting |
