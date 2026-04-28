import { Router } from "express";
import healthRouter from "./health.js";
import streamersRouter from "./streamers.js";
import confessionsRouter from "./confessions.js";
import storageRouter from "./storage.js";
import authChzzkRouter from "./auth-chzzk.js";

const router = Router();

// 모든 라우터를 중앙 라우터에 등록합니다.
(router as any).use(healthRouter);
(router as any).use(streamersRouter);
(router as any).use(confessionsRouter);
(router as any).use(storageRouter);
(router as any).use(authChzzkRouter);

export default router;
