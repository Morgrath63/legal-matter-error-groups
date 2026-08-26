import { createServer } from "node:http";
import { InfraiError } from "./infrai_errors.js";
import { legalFailureSchema, recordLegalFailure } from "./matter_workflow.js";

const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/legal-failures") {
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = legalFailureSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_request", issues: parsed.error.issues }));
      return;
    }

    const result = await recordLegalFailure(parsed.data);
    response.writeHead(202, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof InfraiError && error.status < 500 ? error.status : 500;
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "request_failed" }));
  }
}).listen(port, () => console.log(`Legal error service listening on http://localhost:${port}`));
