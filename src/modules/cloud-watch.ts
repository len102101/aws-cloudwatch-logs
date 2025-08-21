import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { ApiLogData, ErrorLogData } from "../types";
import { v4 as uuidv4 } from "uuid";

export class CloudWatchLogger {
  client!: CloudWatchLogsClient;
  apiLogGroupName!: string;
  errorLogGroupName!: string;
  logStreamPrefix!: string;
  sequenceTokens: Map<string, string> = new Map();
  currentDate: string = "";

  async initialize({
    apiLogGroupName,
    errorLogGroupName,
  }: {
    apiLogGroupName: string;
    errorLogGroupName: string;
  }): Promise<void> {
    try {
      this.logStreamPrefix = "api-logs";

      this.client = new CloudWatchLogsClient({
        region: process.env.AWS_REGION,
        credentials:
          process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              }
            : undefined,
      });
      this.apiLogGroupName = apiLogGroupName;
      this.errorLogGroupName = errorLogGroupName;
      await this.ensureLogGroupExists(this.apiLogGroupName);
      await this.ensureLogGroupExists(this.errorLogGroupName);
      // 초기화 시에는 로그 스트림을 미리 생성하지 않음 (날짜별로 동적 생성)
    } catch (error) {
      console.error("Failed to initialize CloudWatch logger:", error);
      throw error;
    }
  }

  private async sendLogEvent(
    logGroupName: string,
    logStreamName: string,
    message: string
  ): Promise<void> {
    try {
      const streamKey = `${logGroupName}-${logStreamName}`;
      const sequenceToken = this.sequenceTokens.get(streamKey);

      const command = new PutLogEventsCommand({
        logGroupName,
        logStreamName,
        logEvents: [
          {
            timestamp: Date.now(),
            message,
          },
        ],
        sequenceToken,
      });

      const response = await this.client.send(command);

      if (response.nextSequenceToken) {
        this.sequenceTokens.set(streamKey, response.nextSequenceToken);
      }
    } catch (error) {
      console.error("Failed to send log event to CloudWatch:", error);
      // 로그 전송 실패 시에도 애플리케이션이 중단되지 않도록 에러를 던지지 않음
    }
  }

  async logError(req: any, err: any): Promise<string> {
    // ErrorLogData 객체 생성
    const errorId = `ERR_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const statusCode = err.statusCode || 500;

    const errorLogData = {
      errorId,
      method: req.method,
      endpoint: req.path,
      statusCode,
      responseTime: 0, // 에러 발생 시 응답 시간을 측정하기 어려우므로 0으로 설정
      error: {
        name: err.name || err.constructor?.name || "Unknown",
        message: err.message || "No error message",
        stack: err.stack,
      },
      requestBody: req.body,
      userAgent: req.get("User-Agent"),
    };

    // 에러 로그도 더 읽기 쉽게 포맷팅
    const logMessage = this.formatErrorLog(errorLogData);

    const streamName = await this.ensureCurrentDateStreamExists(
      this.errorLogGroupName
    );
    await this.sendLogEvent(this.errorLogGroupName, streamName, logMessage);

    // CloudWatch 콘솔 바로가기 링크 반환
    return this.generateCloudWatchLink(
      this.errorLogGroupName,
      streamName,
      errorId
    );
  }

  async logApiRequest(data: ApiLogData): Promise<void> {
    // 더 구조화되고 찾기 쉬운 로그 형태
    const logMessage = this.formatApiLog(data);

    const streamName = await this.ensureCurrentDateStreamExists(
      this.apiLogGroupName
    );
    await this.sendLogEvent(this.apiLogGroupName, streamName, logMessage);
  }

  /** Utils */
  private getCurrentDateStreamName(): string {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD 형식
    return `${this.logStreamPrefix}-${today}`;
  }

  private async ensureCurrentDateStreamExists(
    logGroupName: string
  ): Promise<string> {
    const streamName = this.getCurrentDateStreamName();

    // 날짜가 바뀌었다면 시퀀스 토큰 캐시 초기화
    const today = new Date().toISOString().split("T")[0];
    if (this.currentDate !== today) {
      this.currentDate = today;
      this.sequenceTokens.clear();
    }

    await this.ensureLogStreamExists(logGroupName, streamName);
    return streamName;
  }

  private async ensureLogGroupExists(logGroupName: string): Promise<void> {
    try {
      const command = new DescribeLogGroupsCommand({
        logGroupNamePrefix: logGroupName,
      });

      const response = await this.client.send(command);
      const exists = response.logGroups?.some(
        (group) => group.logGroupName === logGroupName
      );

      if (!exists) {
        await this.client.send(
          new CreateLogGroupCommand({
            logGroupName,
          })
        );
        console.log(`Created log group: ${logGroupName}`);
      }
    } catch (error) {
      console.error(`Error ensuring log group exists: ${logGroupName}`, error);
      throw error;
    }
  }

  private async ensureLogStreamExists(
    logGroupName: string,
    logStreamName: string
  ): Promise<void> {
    try {
      const command = new DescribeLogStreamsCommand({
        logGroupName,
        logStreamNamePrefix: logStreamName,
      });

      const response = await this.client.send(command);
      const exists = response.logStreams?.some(
        (stream) => stream.logStreamName === logStreamName
      );

      if (!exists) {
        await this.client.send(
          new CreateLogStreamCommand({
            logGroupName,
            logStreamName,
          })
        );
        console.log(`Created log stream: ${logStreamName} in ${logGroupName}`);
      }
    } catch (error) {
      console.error(
        `Error ensuring log stream exists: ${logStreamName}`,
        error
      );
      throw error;
    }
  }

  private formatApiLog(data: ApiLogData): string {
    const statusEmoji = this.getStatusEmoji(data.statusCode);
    const responseTimeLabel = this.getResponseTimeLabel(data.responseTime);

    const logParts = [
      `${statusEmoji} [${data.method}] ${data.endpoint}`,
      `Status: ${data.statusCode}`,
      `Response Time: ${data.responseTime}ms ${responseTimeLabel}`,
    ];

    if (data.requestBody && Object.keys(data.requestBody).length > 0) {
      logParts.push(`Request: ${JSON.stringify(data.requestBody, null, 2)}`);
    }

    if (data.responseBody) {
      let formattedResponse;
      try {
        // 응답이 문자열이면 JSON으로 파싱 시도
        const parsedResponse =
          typeof data.responseBody === "string"
            ? JSON.parse(data.responseBody)
            : data.responseBody;
        formattedResponse = JSON.stringify(parsedResponse, null, 2);
      } catch {
        // 파싱 실패시 원본 그대로 사용
        formattedResponse =
          typeof data.responseBody === "string"
            ? data.responseBody
            : JSON.stringify(data.responseBody, null, 2);
      }

      if (
        formattedResponse &&
        formattedResponse.trim() &&
        formattedResponse !== "{}"
      ) {
        logParts.push(`Response: ${formattedResponse}`);
      }
    }

    if (data.ip) {
      logParts.push(`IP: ${data.ip}`);
    }

    return logParts.join(" | ");
  }

  private getStatusEmoji(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return "✅";
    if (statusCode >= 300 && statusCode < 400) return "🔄";
    if (statusCode >= 400 && statusCode < 500) return "⚠️";
    if (statusCode >= 500) return "❌";
    return "📋";
  }

  private getResponseTimeLabel(responseTime: number): string {
    if (responseTime < 100) return "⚡";
    if (responseTime < 500) return "🟢";
    if (responseTime < 1000) return "🟡";
    if (responseTime < 2000) return "🟠";
    return "🔴";
  }
  private formatErrorLog(data: ErrorLogData): string {
    console.log("data", data);
    const logParts = [
      `🚨 [ERROR_ID: ${data.errorId}]`,
      `[${data.method}] ${data.endpoint}`,
      `Status: ${data.statusCode}`,
      `Response Time: ${data.responseTime}ms`,
      `Error: ${data.error.message}`,
    ];

    if (data.requestBody && Object.keys(data.requestBody).length > 0) {
      logParts.push(`Request: ${JSON.stringify(data.requestBody, null, 2)}`);
    }

    if (data.error.stack) {
      logParts.push(`Stack: ${data.error.stack}`);
    }

    if (data.ip) {
      logParts.push(`IP: ${data.ip}`);
    }

    return logParts.join(" | ");
  }
  private generateCloudWatchLink(
    logGroupName: string,
    logStreamName: string,
    errorId: string
  ): string {
    const encodedLogGroup = encodeURIComponent(logGroupName);
    const encodedLogStream = encodeURIComponent(logStreamName);
    const region = process.env.AWS_REGION;

    // CloudWatch 콘솔에서 특정 로그 스트림으로 이동하는 링크
    const baseUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home`;
    const params = [
      `region=${region}`,
      `#logsV2:log-groups/log-group/${encodedLogGroup}/log-events/${encodedLogStream}`,
      `?filterPattern=${encodeURIComponent(`${errorId}`)}`,
    ].join("");

    return `${baseUrl}?${params}`;
  }

  /**
   * 에러 ID 생성
   */
  public generateErrorId(): string {
    return uuidv4();
  }
}

export const cloudWatchLogger = new CloudWatchLogger();
