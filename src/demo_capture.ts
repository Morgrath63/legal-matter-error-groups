import { recordLegalFailure } from "./matter_workflow.js";

const result = await recordLegalFailure({
  matterId: "MAT-1042",
  workflow: "signed_document_delivery",
  operationId: "delivery-MAT-1042-v1",
  errorName: "DocumentDeliveryError",
  message: "The signed document could not be delivered to counsel",
});

console.log(JSON.stringify(result, null, 2));
