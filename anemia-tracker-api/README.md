# Anemia Tracker API

## School Admin password recovery

Password recovery uses a Resend provider adapter. Configure these environment variables in the local or deployment environment; do not commit real values:

```text
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=no-reply@your-verified-domain.example
```

Production recovery fails closed when either value is missing or email delivery fails. Automated tests mock the provider and do not require a verified Resend domain.

## Local schema inventory

The read-only schema inventory is opt-in and does not run migrations or write database objects. It reports current tables, columns, indexes, constraints, and migration-named tables. Its output is an inventory only; it cannot prove migration history.

Before running it, confirm manually that the configured database is a local development database. Do not use a production or shared-database environment. Keep credentials in the existing secure environment/configuration; never place them on the command line or print them.

```bash
cd anemia-tracker-api
ANEMIA_INVENTORY_CONFIRM=LOCAL node scripts/schema-inventory.js --confirm-local
```

The script refuses to run when `NODE_ENV=production`, requires `DATABASE_URL`, and never falls back to another database. This command was intentionally not run as part of the implementation.
