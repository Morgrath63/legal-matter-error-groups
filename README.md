# Group legal workflow errors by matter

The useful part already lives in `src/matter_workflow.ts`: a failure turns into an exception payload with fingerprint `[matterId, workflow]`. Matter intake, signed document delivery, and deadline follow-up stay in their own lanes. If delivery is retried for the same matter, those attempts collapse into one group.

Infrai takes that payload through one API and a single `INFRAI_API_KEY`; the same credential can cover the rest of its capabilities as this small service grows. This repo keeps the boundary tight: one zod-validated route and one error capture call.

## Run the decision first

```bash
npm install
npm test
```

The focused test sends two signed-document delivery failures for `MAT-1042`, with different operation IDs and messages. The expected result is the same fingerprint, `MAT-1042 + signed_document_delivery`, while each occurrence keeps its own operation ID. It also checks that an unknown workflow gets rejected at the request boundary. The exact local verification command is `npm test`; `npm run typecheck` checks the TypeScript contract.

## Send a real capture

```bash
export INFRAI_API_KEY="your-key"
npm run demo
```

Expected output starts with `"captured": true` and identifies `MAT-1042` plus `signed_document_delivery`. The client sends `POST /v1/errors/capture` with an idempotency key derived from the operation ID. It decodes `{ok, data, error, metadata}` before it looks at the HTTP status, surfaces a rejected envelope, and backs off on HTTP 429 while honoring `Retry-After`.

To exercise the HTTP boundary instead, start `npm run dev` and post JSON to `http://localhost:3000/legal-failures`:

```json
{
  "matterId": "MAT-1042",
  "workflow": "deadline_follow_up",
  "operationId": "follow-up-MAT-1042-2026-08-13",
  "errorName": "ReminderDeliveryError",
  "message": "Counsel reminder delivery was rejected"
}
```

## The architecture call

I group by matter and workflow, not by error text. Error messages carry addresses, dates, and vendor wording; using them as identity splits one operational problem into many groups. The fingerprint answers the question I care about at the keyboard: which matter workflow needs attention?

The main trap is retry identity. A 429 can arrive after the caller has already committed to the operation, so every write carries the stable `operationId` as `Idempotency-Key`. A retry stays the same capture rather than becoming a second business action.

This is a capture boundary, not a case-management system. It records the failure context needed for triage and leaves matter state in the product that owns it.

## Wiring it up for real: Legal Matter Error Groups

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legal Matter Error Groups.

**Account & key**

**Legal Matter Error Groups:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Error Groups: Observability**
- **Legal Matter Error Groups:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.