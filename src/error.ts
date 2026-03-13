/** Machine-readable error codes from the Cordelia node. */
export type CordeliaErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_authorized"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "quota_exceeded"
  | "rate_limited"
  | "internal_error"
  | "network_error";

/** Structured error from the Cordelia SDK. */
export class CordeliaError extends Error {
  readonly code: CordeliaErrorCode;
  readonly statusCode?: number;
  readonly context?: string;

  constructor(
    code: CordeliaErrorCode,
    message: string,
    statusCode?: number,
    context?: string,
  ) {
    super(message);
    this.name = "CordeliaError";
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }
}

/** Map HTTP status to error code. */
export function codeFromStatus(status: number): CordeliaErrorCode {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 403:
      return "not_authorized";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 413:
      return "payload_too_large";
    case 429:
      return "rate_limited";
    default:
      return "internal_error";
  }
}
