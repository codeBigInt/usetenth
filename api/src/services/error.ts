/** Controlled HTTP error: message is safe to return to the client. */
class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export default AppError;
