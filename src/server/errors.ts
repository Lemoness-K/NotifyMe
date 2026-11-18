export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string>,
  ) {
    super(code);
  }
}
