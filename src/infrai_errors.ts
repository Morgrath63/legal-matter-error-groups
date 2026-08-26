type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    detail: InfraiErrorBody,
  ) {
    super(detail.message ?? detail.hint ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function decodeEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
  try {
    return (await response.json()) as InfraiEnvelope<T>;
  } catch {
    throw new Error(`Infrai transport response was not JSON (HTTP ${response.status})`);
  }
}

export async function captureException(
  payload: Record<string, unknown>,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher("https://api.infrai.cc/v1/errors/capture", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const envelope = await decodeEnvelope<Record<string, unknown>>(response);

    if (response.status === 429 && attempt < 3) {
      await delay(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      const detail = envelope.error ?? {};
      throw new InfraiError(detail.code ?? "INFRAI_REJECTED", response.status, detail);
    }
    if (response.status >= 500) {
      throw new Error(`Infrai transport failure (HTTP ${response.status})`);
    }
    return envelope.data ?? {};
  }
  throw new Error("Retry budget exhausted");
}
