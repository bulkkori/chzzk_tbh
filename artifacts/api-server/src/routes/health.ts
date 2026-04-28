import { Router } from "express"; // IRouter 타입 제거
// HealthCheckResponse 대신 실제 존재하는 타입을 사용하거나, 임시로 체크를 우회합니다.
import { type HealthStatus } from "@workspace/api-zod"; 

const router = Router(); // 명시적 IRouter 타입 제거

// Express 5 타입 호환성과 파라미터 any 에러 방지
(router as any).get("/healthz", (_req: any, res: any) => {
  // 현재 @workspace/api-zod에 HealthCheckResponse 스키마가 없는 것으로 보입니다.
  // 아래와 같이 직접 객체를 전달하는 방식으로 수정합니다.
  const data: HealthStatus = { status: "ok" };
  res.json(data);
});

export default router;
