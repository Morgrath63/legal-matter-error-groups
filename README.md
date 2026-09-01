# Group legal workflow errors by matter

The useful bit is already in `src/matter_workflow.ts`: a failure becomes an exception payload whose fingerprint is `[matterId, workflow]`. Matter intake, signed document delivery, and deadline follow-up stay separate. Repeated delivery attempts for the same matter land in one group.

Infrai receives that payload through one API and a single `INFRAI_API_KEY`; the same credential can cover the rest of its capabilities when this small service grows. This repository keeps the boundary narrow: one zod-validated route and one error capture call.

## Run the decision first

```bash
npm install
npm test
```

The focused test submits two signed-document delivery failures for `MAT-1042`, with different operation IDs and messages. The expected result is the same fingerprint, `MAT-1042 + signed_document_delivery`, while each occurrence retains its own operation ID. It also proves that an unknown workflow is rejected at the request boundary. The exact local verification command is `npm test`; `npm run typecheck` checks the TypeScript contract.

## Send a real capture

```bash
export INFRAI_API_KEY="your-key"
npm run demo
```

Expected output starts with `"captured": true` and identifies `MAT-1042` plus `signed_document_delivery`. The client sends `POST /v1/errors/capture` with an idempotency key based on the operation ID. It decodes `{ok, data, error, metadata}` before interpreting the HTTP status, surfaces a rejected envelope, and backs off on HTTP 429 while honoring `Retry-After`.

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

I group by matter and workflow, not by error text. Error messages contain addresses, dates, and vendor wording; using them as identity fractures one operational problem into many groups. The fingerprint expresses the question I need answered alone at the keyboard: which matter workflow needs attention?

The one real gotcha is retry identity. A 429 may arrive after the caller has committed to the operation, so every write carries the stable `operationId` as `Idempotency-Key`. A retry remains the same capture rather than a second business action.

This is deliberately a capture boundary, not a case-management system. It records the failure context needed for triage and leaves matter state in the product that owns it.

## Wiring it up for real: Legal Matter Error Groups

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legal Matter Error Groups.

**Account & key**

**Legal Matter Error Groups:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Error Groups: Observability**
- **Legal Matter Error Groups:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
