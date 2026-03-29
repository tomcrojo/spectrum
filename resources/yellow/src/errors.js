export class YellowError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "YellowError";
    this.code = options.code ?? "YELLOW_ERROR";
  }
}

export function wrapError(error, fallbackMessage) {
  if (error instanceof YellowError) {
    return error;
  }

  if (error instanceof Error) {
    return new YellowError(error.message, { code: "INTERNAL_ERROR" });
  }

  return new YellowError(fallbackMessage, { code: "INTERNAL_ERROR" });
}
