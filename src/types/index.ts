import { Request } from "express";

/**
 * CloudWatch 설정 인터페이스
 */
export interface CloudWatchConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  apiLogGroupName: string;
  errorLogGroupName: string;
  logStreamName?: string;
}

/**
 * API 로그 데이터 인터페이스
 */
export interface ApiLogData {
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  requestBody?: any;
  responseBody?: any;
  ip?: string;
  userAgent?: string;
}

/**
 * 에러 로그 데이터 인터페이스
 */
export interface ErrorLogData {
  errorId: string; // 고유 에러 ID 추가
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  requestBody?: any;
  responseBody?: any;
  ip?: string;
  userAgent?: string;
}

/**
 * 로깅 미들웨어 옵션 인터페이스
 */
export interface LoggingOptions {
  excludePaths?: string[];
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  maxBodySize?: number;
  sensitiveFields?: string[];
}

/**
 * 요청 객체 확장 (로깅용)
 */
export interface RequestWithBody extends Request {
  rawBody?: any;
  startTime?: number;
}

/**
 * 서버 설정 인터페이스
 */
export interface ServerConfig {
  port: number;
  cloudwatch: CloudWatchConfig;
  logging: LoggingOptions;
}

namespace Express {
  interface Request {
    user: any;
    startTime?: number;
  }
}
