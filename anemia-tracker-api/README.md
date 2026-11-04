# Anemia Tracker API

## School Admin password recovery

Password recovery uses a Resend provider adapter. Configure these environment variables in the local or deployment environment; do not commit real values:

```text
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=no-reply@your-verified-domain.example
```

Production recovery fails closed when either value is missing or email delivery fails. Automated tests mock the provider and do not require a verified Resend domain.

## Parent OTP delivery

Parent sign-in requires a real SMS provider in production. The API supports Twilio's REST API without an additional npm dependency:

```text
OTP_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+15551234567
```

The mock provider and development OTP response are disabled in production. Twilio trial accounts may only send to verified recipient numbers and are not a permanent free production SMS solution.

## Demo data

The idempotent demo seed creates synthetic data for three schools and is restricted to an explicitly confirmed database target. It never truncates tables:

```bash
npm run seed:demo
```

For a hosted database, use an explicit remote confirmation only after checking the target connection:

```bash
SEED_DEMO_DATA_CONFIRM=REMOTE NODE_ENV=production node scripts/seed-demo-data.js
```

All demo accounts use the password `Demo@12345`; replace or disable them before real use. Seeded parent phone numbers are synthetic and should not be treated as real contact data.

## Local schema inventory

The read-only schema inventory is opt-in and does not run migrations or write database objects. It reports current tables, columns, indexes, constraints, and migration-named tables. Its output is an inventory only; it cannot prove migration history.

Before running it, confirm manually that the configured database is a local development database. Do not use a production or shared-database environment. Keep credentials in the existing secure environment/configuration; never place them on the command line or print them.

```bash
cd anemia-tracker-api
ANEMIA_INVENTORY_CONFIRM=LOCAL node scripts/schema-inventory.js --confirm-local
```

The script refuses to run when `NODE_ENV=production`, requires `DATABASE_URL`, and never falls back to another database. This command was intentionally not run as part of the implementation.

## Hosted deployment

The repository includes a `render.yaml` blueprint for the Node API. Create a hosted PostgreSQL database first, then deploy the API with these production variables:

- `DATABASE_URL` — hosted PostgreSQL connection string
- `JWT_SECRET` — long random signing secret
- `CORS_ORIGINS` — comma-separated HTTPS web origins, if the web app is deployed
- `OTP_SMS_PROVIDER=twilio` and the three `TWILIO_*` variables for parent OTP
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` for school password recovery

Apply `anemia_tracker_schema.sql` to the empty hosted database, then apply every file in `migrations/` in filename order. After that, run the demo seed once with `SEED_DEMO_DATA_CONFIRM=REMOTE` if demo accounts are wanted in the hosted database.
