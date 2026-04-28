import { Router, type IRouter } from "express";
import healthRouter from "./health";
import streamersRouter from "./streamers";
import confessionsRouter from "./confessions";
import storageRouter from "./storage";
import authChzzkRouter from "./auth-chzzk";

const router: IRouter = Router();

router.use(healthRouter);
router.use(streamersRouter);
router.use(confessionsRouter);
router.use(storageRouter);
router.use(authChzzkRouter);

export default router;
