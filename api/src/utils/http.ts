import type { Response } from "express";

export interface ApiResponse<T> {
  message: string;
  data: T;
  status: number;
}

export function sendSuccess<T>(res: Response, message: string, data: T, status = 200) {
  return res.status(status).send({ message, data, status } satisfies ApiResponse<T>);
}

export function sendError<T>(res: Response, message: string, data: T | null = null, status = 500) {
  return res.status(status).send({ message, data, status } satisfies ApiResponse<T | null>);
}
