import "server-only";

export class ProviderTimeoutError extends Error {
  constructor(ms: number) {
    super(`Provider request timed out after ${ms}ms`);
    this.name = "ProviderTimeoutError";
  }
}

export function getProviderTimeoutMs(): number {
  const raw = Number(process.env.PROVIDER_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 12000;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number = getProviderTimeoutMs()): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProviderTimeoutError(ms)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** 一時的な障害向けの指数バックオフ付きリトライ。1銘柄の失敗が全体に波及しないよう呼び出し側で握りつぶす前提。 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { retries = 1, baseDelayMs = 300 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }

  throw lastError;
}
