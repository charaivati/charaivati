---
module: notifications
type: library
source: lib/sendEmail.ts, lib/sendSms.ts, lib/sms/providers/twilioProvider.ts, lib/sms/providers/localProvider.ts, lib/sms/types.ts
depends_on: []
used_by: [auth, user]
stability: stable
status: active
---

# Module: Notifications

## Purpose
Abstracts email and SMS delivery behind simple functions. Provides a provider pattern for SMS so Twilio can be swapped for a local/mock provider in development.

## Responsibilities
- Send transactional emails via SendGrid (verification, magic links, alerts)
- Send SMS messages via Twilio (OTP codes, alerts)
- Abstract SMS provider selection so dev environments avoid real SMS costs
- Define the SMS provider interface

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Recipient email or phone number |
| In | Message content (subject, body for email; text for SMS) |
| Out | Delivery result (success/failure) |

## Dependencies
- **SendGrid** — external; credentials from `SENDGRID_API_KEY`
- **Twilio** — external; credentials from `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- No internal module dependencies

## Reverse Dependencies (what breaks if this changes)
- `auth` module calls `sendEmail()` for magic links and `sendSms()` for OTPs. If the function signatures change, auth delivery breaks.
- `user` module calls `sendEmail()` for email verification. If the email template or sender changes, verification links break.
- The SMS provider interface (`lib/sms/types.ts`) defines the contract. If it changes, both `twilioProvider.ts` and `localProvider.ts` must be updated.

## Runtime Flow

### Email delivery
1. Caller imports `sendEmail()` from `lib/sendEmail.ts`
2. Passes `{ to, subject, html, text }`
3. Function calls SendGrid API with the payload
4. Returns success or throws on failure

### SMS delivery
1. Caller imports `sendSms()` from `lib/sendSms.ts`
2. Function selects provider based on environment (Twilio in production, local in dev)
3. Calls `provider.send({ to, body })`
4. Returns result

### Provider selection
- `lib/sendSms.ts` instantiates `TwilioProvider` when `TWILIO_ACCOUNT_SID` is present
- Falls back to `LocalProvider` (logs to console) when credentials are absent
- This happens at module load time — no runtime switching

## Key Functions

| Function | File | Role |
|---|---|---|
| `sendEmail()` | lib/sendEmail.ts | Send transactional email via SendGrid |
| `sendSms()` | lib/sendSms.ts | Send SMS via active provider |
| `TwilioProvider.send()` | lib/sms/providers/twilioProvider.ts | Twilio delivery implementation |
| `LocalProvider.send()` | lib/sms/providers/localProvider.ts | Dev no-op / console logger |

## Database Models Used
None directly. Callers write tokens and OTP hashes to the DB before calling this module.

## Risks & Fragile Areas
- SendGrid API failures are not retried. A transient failure on a verification email means the user never receives it and must request a resend manually.
- TODO: Confirm whether `sendEmail` throws or returns an error object on failure. Callers need to handle this consistently.
- The local SMS provider likely logs to console only. In a CI/test environment, SMS OTP flows cannot be fully tested without Twilio credentials or a mock.
- No delivery tracking or bounce handling is observed. Failed deliveries are invisible unless the caller checks the return value.
- Twilio credentials must be set in production. Missing credentials with no fallback would cause `sendSms()` to use the local no-op provider silently in production — a serious misconfiguration risk. TODO: Confirm whether a hard error is thrown if Twilio credentials are absent in production.

## Backlinks
- [[auth.md]] — OTP delivery and magic link email
- [[user.md]] — email verification delivery
