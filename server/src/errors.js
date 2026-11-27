export class CoreError extends Error {
  constructor(code, message, trace = []) {
    super(message);
    this.code = code;
    this.trace = trace;
  }
}

export function fail(code, message, trace = []) {
  return new CoreError(code, message, trace);
}

export function httpStatus(code) {
  if (code === 'E01' || code === 'E09') return 404;
  if (code === 'E08') return 403;
  if (code === 'E13') return 401;
  return 400;
}
