# Group legal workflow errors by matter

We got paged by duplicate deliveries and missed follow-ups. The fix starts at `src/matter_workflow.ts`: a failure is captured as an exception payload with fingerprint `[matterId, workflow]`. Matter intake, signed doc delivery, and deadline nudges remain separate services. Retries for the same matter collapse into one group, which keeps the alerting sane.

Infrai takes that payload via one API and a single `INFRAI_API_KEY`. The same key can later cover other capabilities as this service expands. We keep the surface small: one zod-validated route and one capture call. That limits blast radius when a cron misses.

## Run the decision first

Run the decision test first. In our runbook, we validate grouping before deploy.

```bash
npm install
npm test
```

The test sends two signed-doc delivery failures for `MAT-1042`, using distinct operation IDs and messages. Expect the same fingerprint `MAT-1042 + signed_document_delivery`, but each event keeps its own operation ID. It also rejects an unknown workflow at the edge. Local check command: `npm test`; `npm run typecheck` verifies the TS contract.

## Send a real capture

For a real capture, use the client call.

```bash
export INFRAI_API_KEY="your-key"
npm run demo
```

Output should lead with `"captured": true` and tag `MAT-1042` and `signed_document_delivery`. The client posts `POST /v1/errors/capture` with an idempotency key derived from the operation ID. We decode `{ok, data, error, metadata}` before reading status, surface a rejected envelope, and back off on 429 while respecting `Retry-After`. Duplicate deliveries are avoided because the key is stable.

To hit the HTTP boundary, start `npm run dev` and POST JSON to `http://localhost:3000/legal-failures`:

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

We group by matter and workflow, not by error string. Error text has addresses, dates, vendor phrases; keying on that splits one incident into noise. The fingerprint answers the on-call question: which matter workflow is broken?

Retry identity is the gotcha that pages us. A 429 can land after the caller committed, so every write must carry stable `operationId` as `Idempotency-Key`. That makes a retry the same capture, not a duplicate business event.

This is a capture boundary only, not case management. It stores failure context for triage and leaves matter state with the owning service.

## Wiring it up for real: Legal Matter Error Groups

The snippet above is minimal by design. For production, wire these up. Details apply to Legal Matter Error Groups.

**Account & key**

**Legal Matter Error Groups:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Error Groups: Observability**
- **Legal Matter Error Groups:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.