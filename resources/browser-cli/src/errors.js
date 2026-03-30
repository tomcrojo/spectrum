export class BrowserCliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "BrowserCliError";
    this.code = options.code ?? "BROWSER_CLI_ERROR";
    this.hints = Array.isArray(options.hints) ? options.hints : [];
  }
}

export function wrapError(error, fallbackMessage) {
  if (error instanceof BrowserCliError) {
    return error;
  }

  if (error instanceof Error) {
    return new BrowserCliError(error.message, { code: "INTERNAL_ERROR" });
  }

  return new BrowserCliError(fallbackMessage, { code: "INTERNAL_ERROR" });
}
