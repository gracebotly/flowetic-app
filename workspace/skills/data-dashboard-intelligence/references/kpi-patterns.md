# KPI Row Patterns by Domain
Detailed KPI row configurations for each domain type. The SKILL.md tells you which hero stat to pick; this file tells you the complete 4-card KPI row for each domain.
---
## Voice Domain (Vapi, Retell, or any call-based platform)
Agency clients with voice bots care most about: "How many calls? How reliable? How fast? How much does it cost?"
| Position | Metric | Field Source | Aggregation | Trend Indicator |
|---|---|---|---|---|
| 1 (Hero) | Total Calls | `call_id` or `id` where type = call | `count` | vs. previous 7 days |
| 2 | Success Rate | `status` where `completed` or `ended` | `percentage` | ▲▼ (up is good) |
| 3 | Avg Duration | `duration_ms` or `call_duration_seconds` | `average`, format as seconds/minutes | ▲▼ (context-dependent) |
| 4 | Total Cost | `cost_usd` or `cost` | `sum`, format as currency | ▲▼ (down is good) |
**If cost field doesn't exist**: Replace position 4 with "Unique Callers" (`count distinct` on caller field) or "Calls Today" (count where timestamp = today).
**If duration field doesn't exist**: Replace position 3 with "Failed Calls" (count where status = failed/error).
---
## Workflow Domain (n8n, Make, Zapier, ActivePieces)
Agency clients with workflow automations care most about: "Is it working? How much? How fast? What's breaking?"
| Position | Metric | Field Source | Aggregation | Trend Indicator |
|---|---|---|---|---|
| 1 (Hero) | Success Rate | `status` where `completed`/`success` | `percentage` | vs. previous 7 days |
| 2 | Total Executions | `execution_id` or `id` | `count` | ▲▼ (up is good) |
| 3 | Avg Duration | `duration_ms` | `average`, format as seconds | ▲▼ (down is good — faster is better) |
| 4 | Error Count | `status` where `failed`/`error` | `count` | ▲▼ inverted (down is good) |
**Why success rate is hero (not total executions)**: For workflow clients, reliability is the #1 concern. They want to know "is my automation reliable?" before "how many times did it run?" A workflow that ran 1,000 times with 50% failure rate is worse than one that ran 100 times at 99%.
---
## Chat/Conversation Domain
| Position | Metric | Field Source | Aggregation | Trend Indicator |
|---|---|---|---|---|
| 1 (Hero) | Active Conversations | `conversation_id` or `session_id` | `count` where status = active | vs. previous 7 days |
| 2 | Resolution Rate | `status` where `resolved` | `percentage` | ▲▼ (up is good) |
| 3 | Avg Response Time | `response_time_ms` or derived | `average`, format as seconds | ▲▼ (down is good) |
| 4 | Escalations | `status` where `escalated` or `transferred` | `count` | ▲▼ inverted (down is good) |
---
## Support/Ticket Domain
| Position | Metric | Field Source | Aggregation | Trend Indicator |
|---|---|---|---|---|
| 1 (Hero) | Avg Resolution Time | `resolved_at - created_at` | `average`, format as hours | vs. previous 7 days |
| 2 | Open Tickets | `status` where `open`/`pending` | `count` | ▲▼ inverted (down is good) |
| 3 | Resolution Rate | `status` where `resolved`/`closed` | `percentage` | ▲▼ (up is good) |
| 4 | SLA Breaches | `sla_breached` flag or derived | `count` | ▲▼ inverted (down is good) |
---
## Revenue/Billing Domain
| Position | Metric | Field Source | Aggregation | Trend Indicator |
|---|---|---|---|---|
| 1 (Hero) | Total Revenue | `amount` or `revenue` | `sum`, format as currency | vs. previous period |
| 2 | Transaction Count | `id` or `payment_id` | `count` | ▲▼ (up is good) |
| 3 | Avg Transaction | `amount` | `average`, format as currency | ▲▼ (up is good) |
| 4 | Refund Rate | Derived from `status = refunded` | `percentage` | ▲▼ inverted (down is good) |
---
## Generic Fallback
When no domain is clearly detected, use this safe pattern:
| Position | Metric | Field Source | Aggregation | Condition |
|---|---|---|---|---|
| 1 (Hero) | Total Events | Any ID field | `count` | Always available |
| 2 | Success Rate | Any status field | `percentage` | Only if status field exists |
| 3 | Avg Duration | Any duration field | `average` | Only if duration field exists |
| 4 | Unique Entities | Any grouping field | `count distinct` | Only if grouping field exists |
If only 2 fields map to KPI cards, show 2 cards. Never show fewer than 2 or more than 5. If only 1 field maps, show it as a single hero card at double width.
---
## Trend Indicator Rules
Trend indicators (▲▼) compare the current period to the previous period of the same length. The "current period" defaults to the last 7 days, with the "previous period" being the 7 days before that.
| Indicator | Meaning | Color |
|---|---|---|
| ▲ 12% | Value increased 12% vs previous period | Green (for metrics where up is good) |
| ▼ 8% | Value decreased 8% vs previous period | Green (for metrics where down is good, like error count) |
| ▲ 12% | Value increased 12% vs previous period | Red (for metrics where up is bad, like error count) |
| — | No change or insufficient data for comparison | Gray/neutral |
Some metrics have **inverted** indicators where down is good (error count, cost, resolution time, escalations). The KPI patterns above note which metrics are inverted.
