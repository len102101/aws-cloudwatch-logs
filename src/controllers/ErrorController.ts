import {
  Controller,
  Get,
  Post,
  Body,
  Route,
  Tags,
  Response,
  SuccessResponse,
  Path,
  Query,
} from "tsoa";
import { ApiResponse } from "../interfaces/ApiResponse";

interface ErrorTestRequest {
  /** 에러 메시지 */
  message?: string;
  /** 지연 시간 (ms) */
  delay?: number;
}

/**
 * 에러 테스트용 컨트롤러
 * CloudWatch 로깅 및 모니터링을 위한 다양한 에러 시나리오를 제공합니다.
 */
@Route("errors")
@Tags("Error Testing")
export class ErrorController extends Controller {
  /**
   * 기본 500 Internal Server Error 발생
   * @summary 기본 서버 에러 테스트
   */
  @Get("500")
  @Response<ApiResponse>("500", "Internal Server Error")
  public async internalServerError(): Promise<void> {
    // 상태 코드를 먼저 설정
    this.setStatus(500);

    // 의도적으로 에러 발생
    throw new Error(
      "의도적으로 발생시킨 500 에러입니다. CloudWatch 로깅 테스트용!"
    );
  }

  /**
   * 커스텀 메시지로 500 에러 발생
   * @summary 커스텀 메시지 에러 테스트
   */
  @Post("500/custom")
  @Response<ApiResponse>("500", "Custom Internal Server Error")
  public async customError(@Body() body: ErrorTestRequest): Promise<void> {
    const message = body.message || "커스텀 에러 메시지입니다.";

    // 상태 코드 설정
    this.setStatus(500);

    // 지연 시간이 있다면 대기
    if (body.delay && body.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, body.delay));
    }

    throw new Error(`🔥 ${message}`);
  }

  /**
   * 타입 에러 발생 (undefined 접근)
   * @summary TypeError 테스트
   */
  @Get("type-error")
  @Response<ApiResponse>("500", "Type Error")
  public async typeError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    // undefined 객체의 속성에 접근하여 TypeError 발생
    const undefinedObject: any = undefined;
    const result = undefinedObject.someProperty.anotherProperty;

    // 이 라인은 실행되지 않음
  }

  /**
   * 참조 에러 발생 (정의되지 않은 변수 접근)
   * @summary ReferenceError 테스트
   */
  @Get("reference-error")
  @Response<ApiResponse>("500", "Reference Error")
  public async referenceError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    // 정의되지 않은 변수에 접근
    // @ts-ignore - 의도적으로 에러를 발생시키기 위해 타입 체크 무시
    console.log(nonExistentVariable);

    throw new Error("This should not be reached");
  }

  /**
   * JSON 파싱 에러 시뮬레이션
   * @summary JSON Parse Error 테스트
   */
  @Get("json-error")
  @Response<ApiResponse>("500", "JSON Parse Error")
  public async jsonError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    const invalidJson = '{"invalid": json, syntax}';

    try {
      JSON.parse(invalidJson);
    } catch (error) {
      throw new Error(
        `JSON 파싱 실패: ${
          error instanceof Error ? error.message : "알 수 없는 에러"
        }`
      );
    }

    throw new Error("This should not be reached");
  }

  /**
   * 비동기 에러 발생
   * @summary Async Error 테스트
   */
  @Get("async-error")
  @Response<ApiResponse>("500", "Async Error")
  public async asyncError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    // Promise rejection
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error("비동기 작업에서 발생한 에러입니다."));
      }, 100);
    });

    throw new Error("This should not be reached");
  }

  /**
   * 메모리 부족 시뮬레이션 (큰 배열 생성)
   * @summary Memory Error 테스트
   */
  @Get("memory-error")
  @Response<ApiResponse>("500", "Memory Error")
  public async memoryError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    try {
      // 매우 큰 배열을 생성하여 메모리 부족 상황 시뮬레이션
      const largeArray = new Array(10000000).fill("memory test");
      const evenLargerArray = largeArray.map((item) =>
        new Array(1000).fill(item).join("")
      );

      // 실제로는 이전에 에러가 발생할 수 있음
      console.log(evenLargerArray.length);
    } catch (error) {
      throw new Error(
        `메모리 관련 에러: ${
          error instanceof Error ? error.message : "메모리 부족"
        }`
      );
    }

    throw new Error("메모리 스트레스 테스트 완료 - 의도적 에러");
  }

  /**
   * 네트워크 에러 시뮬레이션
   * @summary Network Error 테스트
   */
  @Get("network-error")
  @Response<ApiResponse>("500", "Network Error")
  public async networkError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    try {
      // 존재하지 않는 URL로 요청 시뮬레이션
      const response = await fetch(
        "http://nonexistent-domain-12345.com/api/test"
      );
      await response.json();
    } catch (error) {
      throw new Error(
        `네트워크 에러: ${error instanceof Error ? error.message : "연결 실패"}`
      );
    }

    throw new Error("This should not be reached");
  }

  /**
   * 데이터베이스 연결 실패 시뮬레이션
   * @summary Database Error 테스트
   */
  @Get("database-error")
  @Response<ApiResponse>("500", "Database Error")
  public async databaseError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    // 실제 DB 연결은 없지만 DB 에러 시뮬레이션
    const simulatedDbError = new Error("Connection to database failed");
    simulatedDbError.name = "DatabaseConnectionError";

    throw simulatedDbError;
  }

  /**
   * 권한 관련 500 에러 (인증은 성공했지만 서버 내부에서 권한 처리 실패)
   * @summary Authorization Processing Error 테스트
   */
  @Get("auth-processing-error")
  @Response<ApiResponse>("500", "Authorization Processing Error")
  public async authProcessingError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    // 권한 처리 과정에서 발생한 서버 에러 시뮬레이션
    throw new Error("사용자 권한 처리 중 서버 내부 에러가 발생했습니다.");
  }

  /**
   * 타임아웃 에러 시뮬레이션
   * @summary Timeout Error 테스트
   */
  @Get("timeout-error/{seconds}")
  @Response<ApiResponse>("500", "Timeout Error")
  public async timeoutError(@Path() seconds: number): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    // 지정된 시간만큼 대기 후 타임아웃 에러 발생
    const timeoutMs = Math.min(seconds * 1000, 30000); // 최대 30초

    await new Promise((resolve) => setTimeout(resolve, timeoutMs));

    throw new Error(`${seconds}초 후 타임아웃 에러가 발생했습니다.`);
  }

  /**
   * 순환 참조 에러 시뮬레이션
   * @summary Circular Reference Error 테스트
   */
  @Get("circular-reference-error")
  @Response<ApiResponse>("500", "Circular Reference Error")
  public async circularReferenceError(): Promise<void> {
    // 상태 코드 설정
    this.setStatus(500);

    // 순환 참조 객체 생성
    const obj: any = { name: "test" };
    obj.self = obj;

    try {
      // JSON.stringify는 순환 참조가 있으면 에러 발생
      JSON.stringify(obj);
    } catch (error) {
      throw new Error(
        `순환 참조 에러: ${
          error instanceof Error ? error.message : "순환 참조 감지"
        }`
      );
    }

    throw new Error("This should not be reached");
  }

  /**
   * 에러 테스트 목록 반환 (정상 응답)
   * @summary 사용 가능한 에러 테스트 목록
   */
  @Get("list")
  @SuccessResponse("200", "에러 테스트 목록 조회 성공")
  public async getErrorTestList(): Promise<
    ApiResponse<{
      endpoints: { path: string; description: string; method: string }[];
    }>
  > {
    const endpoints = [
      {
        path: "/errors/500",
        description: "기본 500 Internal Server Error",
        method: "GET",
      },
      {
        path: "/errors/500/custom",
        description: "커스텀 메시지 500 에러",
        method: "POST",
      },
      {
        path: "/errors/type-error",
        description: "TypeError 테스트",
        method: "GET",
      },
      {
        path: "/errors/reference-error",
        description: "ReferenceError 테스트",
        method: "GET",
      },
      {
        path: "/errors/json-error",
        description: "JSON Parse Error 테스트",
        method: "GET",
      },
      {
        path: "/errors/async-error",
        description: "비동기 에러 테스트",
        method: "GET",
      },
      {
        path: "/errors/memory-error",
        description: "메모리 에러 시뮬레이션",
        method: "GET",
      },
      {
        path: "/errors/network-error",
        description: "네트워크 에러 시뮬레이션",
        method: "GET",
      },
      {
        path: "/errors/database-error",
        description: "데이터베이스 에러 시뮬레이션",
        method: "GET",
      },
      {
        path: "/errors/auth-processing-error",
        description: "권한 처리 에러 시뮬레이션",
        method: "GET",
      },
      {
        path: "/errors/timeout-error/{seconds}",
        description: "타임아웃 에러 시뮬레이션",
        method: "GET",
      },
      {
        path: "/errors/circular-reference-error",
        description: "순환 참조 에러 시뮬레이션",
        method: "GET",
      },
    ];

    return {
      success: true,
      data: { endpoints },
      message:
        "에러 테스트를 위한 엔드포인트 목록입니다. CloudWatch 로깅 확인용으로 사용하세요.",
    };
  }
}
