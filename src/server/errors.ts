export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string>,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}
