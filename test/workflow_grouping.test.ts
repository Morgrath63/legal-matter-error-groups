import assert from "node:assert/strict";
import test from "node:test";
import { exceptionPayload, legalFailureSchema } from "../src/matter_workflow.js";

test("repeated delivery failures for one matter share a group", () => {
  const first = legalFailureSchema.parse({
    matterId: "MAT-1042",
    workflow: "signed_document_delivery",
    operationId: "attempt-1",
    errorName: "DeliveryError",
    message: "Mailbox rejected delivery",
  });
  const second = { ...first, operationId: "attempt-2", message: "Recipient address rejected" };

  assert.deepEqual(exceptionPayload(first).fingerprint, ["MAT-1042", "signed_document_delivery"]);
  assert.deepEqual(exceptionPayload(second).fingerprint, exceptionPayload(first).fingerprint);
  assert.notEqual(exceptionPayload(second).context.operationId, exceptionPayload(first).context.operationId);
});

test("request boundary rejects an unknown workflow", () => {
  const parsed = legalFailureSchema.safeParse({
    matterId: "MAT-1042",
    workflow: "billing",
    operationId: "attempt-3",
    errorName: "BillingError",
    message: "Rejected",
  });
  assert.equal(parsed.success, false);
});
