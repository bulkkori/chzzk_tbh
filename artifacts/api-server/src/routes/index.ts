import { Router } from "express"; // IRouter 타입 제거
import healthRouter from "./health.js"; // .js 추가
import streamersRouter from "./streamers.js"; // .js 추가
import confessionsRouter from "./confessions.js"; // .js 추가
import storageRouter from "./storage.js"; // .js 추가
import authChzzkRouter from "./auth-chzzk.js"; // .js 추가

const router = Router(); // 타입을 any로 인식하도록 명시적 타입 제거

// Express 5 타입 호환성을 위해 any로 캐스팅하여 사용
(router as any).use(healthRouter);
(router as any).use(streamersRouter);
(router as any).use(confessionsRouter);
(router as any).use(storageRouter);
(router as any).use(authChzzkRouter);

export default router;
