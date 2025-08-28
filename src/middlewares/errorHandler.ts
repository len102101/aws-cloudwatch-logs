import { Request, Response, NextFunction } from "express";
import { cloudWatchLogger } from "../modules/cloud-watch";

/**
 * Slack 웹훅으로 알림 전송
 */
export async function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;

  // 500 에러인 경우 CloudWatch 로깅
  if (statusCode === 500) {
    await cloudWatchLogger.logError(req, err);
  }

  const responseBody = {
    message: err.message || "Internal Server Error",
    code: null,
  };
  if (typeof err.code === "number") {
    responseBody.code = err.code;
  }

  return res.status(statusCode).json(responseBody);
}
