# Anemia Tracker API

## School Admin password recovery

Password recovery uses a Resend provider adapter. Configure these environment variables in the local or deployment environment; do not commit real values:

```text
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=no-reply@your-verified-domain.example
```

Production recovery fails closed when either value is missing or email delivery fails. Automated tests mock the provider and do not require a verified Resend domain.
