import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes/index.js"; // 폴더인 경우 index.js까지 명시 권장
import { logger } from "./lib/logger.js";

const app: Express = express();

app.set("trust proxy", 1);

// ALLOWED_ORIGINS 환경변수로 허용할 프론트엔드 도메인을 지정하세요.
// 예: ALLOWED_ORIGINS=https://your-app.vercel.app
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((d) => d.trim())
  : true;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "요청이 너무 많아요. 15분 후에 다시 시도해 주세요." },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
});

app.use("/api/auth", authLimiter);
app.use("/api/streamers/register", authLimiter);
app.use("/api", generalLimiter);
app.use("/api", router);

export default app;
