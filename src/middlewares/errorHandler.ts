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
  // cloudWatchLink 생성
  if (statusCode === 500) {
    const cloudWatchLink = await cloudWatchLogger.logError(req, err);
    console.log(cloudWatchLink);

    // 응답이 이미 전송되었는지 확인
    if (!res.headersSent) {
      const responseBody = {
        message: err.message || "Internal Server Error",
        code: null,
      };
      if (typeof err.code === "number") {
        responseBody.code = err.code;
      }
      return res.status(statusCode).json(responseBody);
    }
  }

  next(err);
}
