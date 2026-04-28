// [중요] 상대 경로 임포트 시 .js 확장자 추가
export * from "./generated/api.js"; 
export type {
  AnswerConfessionInput,
  Category,
  Confession,
  ConfessionPreview,
  ConfessionStats,
  ConfessionStatsByCategoryItem,
  CreateConfessionInput,
  DeleteConfessionInput,
  ErrorResponse,
  HealthStatus,
  ListAllConfessionsParams,
  ListConfessionsParams,
  ListPrivateConfessionsParams,
  LoginInput,
  LoginResponse,
  SuccessResponse,
  UploadUrlRequest,
  UploadUrlResponse,
  Verdict,
  VerdictInput,
} from "./generated/types/index.js"; // 폴더 내부의 index.js 명시

export type { GetConfessionParams as GetConfessionQueryStringParams } from "./generated/types/index.js";
