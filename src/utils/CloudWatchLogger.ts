import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { CloudWatchConfig, ApiLogData, ErrorLogData } from "../types";
import { v4 as uuidv4 } from "uuid";

export class CloudWatchLogger {
  private client: CloudWatchLogsClient;
  private config: CloudWatchConfig;
  private logStreamPrefix: string;
  private sequenceTokens: Map<string, string> = new Map();
  private currentDate: string = "";

  constructor(config: CloudWatchConfig) {
    this.config = config;
    this.logStreamPrefix = config.logStreamName || "api-logs";

    this.client = new CloudWatchLogsClient({
      region: config.region,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureLogGroupExists(this.config.apiLogGroupName);
      await this.ensureLogGroupExists(this.config.errorLogGroupName);
      // 초기화 시에는 로그 스트림을 미리 생성하지 않음 (날짜별로 동적 생성)
    } catch (error) {
      console.error("Failed to initialize CloudWatch logger:", error);
      throw error;
    }
  }

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

  async logApiRequest(data: ApiLogData): Promise<void> {
    // 더 구조화되고 찾기 쉬운 로그 형태
    const logMessage = this.formatApiLog(data);

    const streamName = await this.ensureCurrentDateStreamExists(
      this.config.apiLogGroupName
    );
    await this.sendLogEvent(
      this.config.apiLogGroupName,
      streamName,
      logMessage
    );
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

  async logError(data: ErrorLogData): Promise<string> {
    // 에러 로그도 더 읽기 쉽게 포맷팅
    const logMessage = this.formatErrorLog(data);

    const streamName = await this.ensureCurrentDateStreamExists(
      this.config.errorLogGroupName
    );
    await this.sendLogEvent(
      this.config.errorLogGroupName,
      streamName,
      logMessage
    );

    // CloudWatch 콘솔 바로가기 링크 반환
    return this.generateCloudWatchLink(
      this.config.errorLogGroupName,
      streamName,
      data.errorId
    );
  }

  private formatErrorLog(data: ErrorLogData): string {
    const logParts = [
      `🚨 [ERROR_ID: ${data.errorId}]`,
      `[${data.method}] ${data.endpoint}`,
      `Status: ${data.statusCode}`,
      `Response Time: ${data.responseTime}ms`,
      `Error: ${data.error.message}`,
      `Error Stack: ${data.error.stack}`,
    ];

    if (data.requestBody && Object.keys(data.requestBody).length > 0) {
      logParts.push(`Request: ${JSON.stringify(data.requestBody, null, 2)}`);
    }

    if (data.ip) {
      logParts.push(`IP: ${data.ip}`);
    }

    return logParts.join(" | ");
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

  /**
   * CloudWatch 콘솔 바로가기 링크 생성
   */
  private generateCloudWatchLink(
    logGroupName: string,
    logStreamName: string,
    errorId: string
  ): string {
    const encodedLogGroup = encodeURIComponent(logGroupName);
    const encodedLogStream = encodeURIComponent(logStreamName);
    const region = this.config.region;

    // CloudWatch 콘솔에서 특정 로그 스트림으로 이동하는 링크
    const baseUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home`;
    const params = [
      `region=${region}`,
      `#logsV2:log-groups/log-group/${encodedLogGroup}/log-events/${encodedLogStream}`,
      `?filterPattern=${encodeURIComponent(`ERROR_ID: ${errorId}`)}`,
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
