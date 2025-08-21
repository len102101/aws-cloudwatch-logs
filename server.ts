import * as dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import { ValidateError } from "tsoa";
import swaggerUi from "swagger-ui-express";

import { RegisterRoutes } from "./build/routes";
import { loggingMiddleware } from "./src/middlewares/loggingMiddleware";
import { errorHandler } from "./src/middlewares/errorHandler";
import { cloudWatchLogger } from "./src/modules/cloud-watch";

dotenv.config();

async function start() {
  const app = express();

  // CloudWatch Logger 초기화

  await cloudWatchLogger.initialize({
    apiLogGroupName: process.env.CLOUDWATCH_API_LOG_GROUP || "",
    errorLogGroupName: process.env.CLOUDWATCH_ERROR_LOG_GROUP || "",
  });

  // Health check 엔드포인트 추가
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Body parser 미들웨어 추가
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.use(loggingMiddleware);

  // TSOA 라우트 등록
  RegisterRoutes(app);

  // Swagger UI 설정 (옵션)
  try {
    const swaggerDocument = require("./build/swagger.json");
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log("Swagger UI available at http://localhost:3001/api-docs");
  } catch (error) {
    console.log(
      "Swagger documentation not available. Run 'npm run build' first."
    );
  }

  // 기본 라우트
  app.get("/", (req, res) => {
    res.json({
      message: "TSOA CRUD API Server",
      docs: "/api-docs",
      endpoints: {
        users: "/users",
        errors: "/errors",
      },
    });
  });

  app.use(
    (
      err: unknown,
      req: Request,
      res: Response,
      next: NextFunction
    ): Response | void => {
      if (err instanceof ValidateError) {
        console.warn(`Caught Validation Error for ${req.path}:`, err.fields);
        return res.status(422).json({
          message: "Validation Failed",
          details: err?.fields,
        });
      }
      if (err instanceof Error) {
        errorHandler(err, req, res, next);
      }

      next();
    }
  );

  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

start().catch(console.error);
