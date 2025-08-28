import { Request, Response, NextFunction } from "express";
import { cloudWatchLogger } from "../modules/cloud-watch";
import { EXCLUDE_PATHS } from "../modules/constants";
import { ApiLogData } from "../types";
import { getClientIp, sanitizeData } from "../modules/utils";

function shouldSkipPath(path: string, excludePaths: string[]): boolean {
  if (!excludePaths) return false;
  return excludePaths.some((excludePath) => {
    // 정확한 경로 매칭을 위해 수정
    if (excludePath === "/") {
      return path === "/";
    }
    return path.startsWith(excludePath);
  });
}

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (shouldSkipPath(req.originalUrl, EXCLUDE_PATHS)) {
    return next();
  }
  const startTime = Date.now();
  (req as any).startTime = startTime; // 에러 핸들러에서 사용할 수 있도록 저장
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  let responseBody: any;

  // res.send 오버라이드
  res.send = function (this: Response, body: any) {
    if (!res.headersSent) {
      responseBody = body;
      return originalSend(body);
    }
    return res;
  };

  // res.json 오버라이드
  res.json = function (this: Response, body: any) {
    if (!res.headersSent) {
      responseBody = body;
      return originalJson(body);
    }
    return res;
  };

  // 응답이 완료되면 로깅
  res.on("finish", async () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    try {
      const logData: ApiLogData = {
        method: req.method,
        endpoint: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTime,
        requestBody: sanitizeData(req.body),
        responseBody: sanitizeData(responseBody),
        ip: getClientIp(req),
        userAgent: req.get("User-Agent"),
      };

      // 콘솔에도 보기 좋은 형태로 출력
      console.log(
        `🔍 API Request: ${logData.method} ${logData.endpoint} → ${logData.statusCode} (${logData.responseTime}ms)`
      );

      await cloudWatchLogger.logApiRequest(logData);
    } catch (error) {
      // 로깅 실패는 조용히 처리 (AWS CloudWatch에 별도 에러 로그 전송 가능)
    }
  });

  next();
}
