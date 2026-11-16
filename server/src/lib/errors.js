export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (fields, message = 'Please correct the highlighted fields.') =>
  new ApiError(400, 'validation_error', message, fields);
export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);
export const conflict = (code, message) => new ApiError(409, code, message);
