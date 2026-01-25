
# n8n Workflow Archetypes (Reference)

Use this to tailor wording + dashboard extras based on what the user is building.

## 1) Ops Monitoring (default)
User intent:
- "keep it running", "alerts", "debug", "reliability"
Best experience:
- Workflow Activity Dashboard default
Add-ons:
- top failing workflows
- recent errors
- slowest workflows

## 2) Data Sync / ETL
User intent:
- "sync HubSpot ↔ Sheets", "database updates", "enrichment"
Dashboard add-ons:
- volume over time
- failure breakdown by integration
Optional (only if workflow emits it):
- records_processed
- source_system / target_system labels

## 3) SaaS Wrapper / Productized Automation (hide n8n)
User intent:
- "sell this as a product", "white-label", "client-facing"
Flow:
- Dashboard-first preview → then offer "Turn into Product"
Product characteristics:
- clear input form
- predictable output
- branded copy that never mentions n8n
Metrics to highlight:
- submissions (runs)
- success rate
- average time to deliver output
- recent client activity

## 4) AI Agent Pipelines
User intent:
- "AI research agent", "lead qualifier", "email writer"
Dashboard add-ons (only if data exists):
- model usage breakdown
- latency per step
- cost/tokens if explicitly logged by the workflow

