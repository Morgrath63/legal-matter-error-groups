import { z } from "zod";
import { captureException } from "./infrai_errors.js";

export const legalFailureSchema = z.object({
  matterId: z.string().min(1),
  workflow: z.enum(["matter_intake", "signed_document_delivery", "deadline_follow_up"]),
  operationId: z.string().min(1),
  errorName: z.string().min(1),
  message: z.string().min(1),
});

export type LegalFailure = z.infer<typeof legalFailureSchema>;

export function exceptionPayload(input: LegalFailure) {
  return {
    title: `${input.workflow} failed for matter ${input.matterId}`,
    message: input.message,
    level: "error",
    fingerprint: [input.matterId, input.workflow],
    exception: `${input.errorName}: ${input.message}`,
    context: {
      matterId: input.matterId,
      workflow: input.workflow,
      operationId: input.operationId,
    },
  };
}

export async function recordLegalFailure(input: LegalFailure) {
  const data = await captureException(exceptionPayload(input), input.operationId);
  return { captured: true as const, matterId: input.matterId, workflow: input.workflow, data };
}
