import {
  Body,
  Controller,
  Delete,
  Get,
  Path,
  Post,
  Put,
  Query,
  Route,
  Tags,
  Response,
  SuccessResponse,
} from "tsoa";
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from "../models/User";
import { ApiResponse, PaginatedResponse } from "../interfaces/ApiResponse";

// 빈 데이터 (실제 DB 대신 사용)
let mockUsers: User[] = [];

let nextId = 1;

@Route("users")
@Tags("User")
export class UserController extends Controller {
  /**
   * 모든 사용자 조회 (페이지네이션 지원)
   */
  @Get()
  @SuccessResponse("200", "사용자 목록 조회 성공")
  @Response<ApiResponse>("400", "잘못된 요청")
  public async getUsers(
    @Query() page: number = 1,
    @Query() limit: number = 10
  ): Promise<PaginatedResponse<UserResponse>> {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedUsers = mockUsers.slice(startIndex, endIndex);
    const userResponses: UserResponse[] = paginatedUsers.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }));

    return {
      success: true,
      data: userResponses,
      pagination: {
        page,
        limit,
        total: mockUsers.length,
        totalPages: Math.ceil(mockUsers.length / limit),
      },
    };
  }

  /**
   * 특정 사용자 조회
   */
  @Get("{userId}")
  @SuccessResponse("200", "사용자 조회 성공")
  @Response<ApiResponse>("404", "사용자를 찾을 수 없음")
  public async getUser(
    @Path() userId: number
  ): Promise<ApiResponse<UserResponse>> {
    if (userId === 1) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    const user = mockUsers.find((u) => u.id === userId);

    if (!user) {
      this.setStatus(404);
      return {
        success: false,
        error: "사용자를 찾을 수 없습니다.",
      };
    }

    const userResponse: UserResponse = {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return {
      success: true,
      data: userResponse,
    };
  }

  /**
   * 새 사용자 생성
   */
  @Post()
  @SuccessResponse("201", "사용자 생성 성공")
  @Response<ApiResponse>("400", "잘못된 요청")
  public async createUser(
    @Body() requestBody: CreateUserRequest
  ): Promise<ApiResponse<UserResponse>> {
    // 이메일 중복 체크
    const existingUser = mockUsers.find((u) => u.email === requestBody.email);
    if (existingUser) {
      this.setStatus(400);
      return {
        success: false,
        error: "이미 존재하는 이메일입니다.",
      };
    }

    const now = new Date();
    const newUser: User = {
      id: nextId++,
      name: requestBody.name,
      email: requestBody.email,
      age: requestBody.age,
      createdAt: now,
      updatedAt: now,
    };

    mockUsers.push(newUser);

    const userResponse: UserResponse = {
      ...newUser,
      createdAt: newUser.createdAt.toISOString(),
      updatedAt: newUser.updatedAt.toISOString(),
    };

    this.setStatus(201);
    return {
      success: true,
      data: userResponse,
      message: "사용자가 성공적으로 생성되었습니다.",
    };
  }

  /**
   * 사용자 정보 수정
   */
  @Put("{userId}")
  @SuccessResponse("200", "사용자 수정 성공")
  @Response<ApiResponse>("404", "사용자를 찾을 수 없음")
  @Response<ApiResponse>("400", "잘못된 요청")
  public async updateUser(
    @Path() userId: number,
    @Body() requestBody: UpdateUserRequest
  ): Promise<ApiResponse<UserResponse>> {
    const userIndex = mockUsers.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      this.setStatus(404);
      return {
        success: false,
        error: "사용자를 찾을 수 없습니다.",
      };
    }

    // 이메일 중복 체크 (다른 사용자와 중복되는지)
    if (requestBody.email) {
      const existingUser = mockUsers.find(
        (u) => u.email === requestBody.email && u.id !== userId
      );
      if (existingUser) {
        this.setStatus(400);
        return {
          success: false,
          error: "이미 존재하는 이메일입니다.",
        };
      }
    }

    const updatedUser = {
      ...mockUsers[userIndex],
      ...requestBody,
      updatedAt: new Date(),
    };

    mockUsers[userIndex] = updatedUser;

    const userResponse: UserResponse = {
      ...updatedUser,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };

    return {
      success: true,
      data: userResponse,
      message: "사용자 정보가 성공적으로 수정되었습니다.",
    };
  }

  /**
   * 사용자 삭제
   */
  @Delete("{userId}")
  @SuccessResponse("200", "사용자 삭제 성공")
  @Response<ApiResponse>("404", "사용자를 찾을 수 없음")
  public async deleteUser(@Path() userId: number): Promise<ApiResponse> {
    const userIndex = mockUsers.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      this.setStatus(404);
      return {
        success: false,
        error: "사용자를 찾을 수 없습니다.",
      };
    }

    mockUsers.splice(userIndex, 1);

    return {
      success: true,
      message: "사용자가 성공적으로 삭제되었습니다.",
    };
  }
}
