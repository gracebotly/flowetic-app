## Environment Variables

### Database Connection

**For Supabase Session Pooler (recommended for serverless):**
```
DATABASE_URL=postgresql://postgres.lxtcafurqwpfhzdkkryr:YOUR_PASSWORD@aws-0-us-west-2.pooler.supabase.com:6543/postgres
```

**Important:** 
- Port `6543` is required for Supabase Transaction Pooler
- Port `5432` is for direct connections (not pooled)
- The `.pooler.supabase.com` hostname requires port `6543`

**For Development (Direct Connection):**
```
DATABASE_URL=postgresql://postgres.lxtcafurqwpfhzdkkryr:YOUR_PASSWORD@aws-0-us-west-2.db.supabase.com:5432/postgres
```
Three webhooks, three jobs:
WebhookURLHandlesSecretBilling/api/billing/webhooksAgencies pay you (SaaS subscriptions)
STRIPE_BILLING_WEBHOOK_SECRETConnect/api/stripe/webhooksClient pays agency (Connect commissions)
STRIPE_WEBHOOK_SECRETConnect V2/api/stripe/webhooks/v2Connected account status syncSTRIPE_CONNECT_WEBHOOK_SECRET (new)
