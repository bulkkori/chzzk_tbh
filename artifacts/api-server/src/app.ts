import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app = express();
(app as any).set("trust proxy", 1);

// 1. 허용할 도메인 목록을 명시적으로 정리합니다.
const allowedOrigins = [
  "https://chzzk-tbh-confession-board-blond.vercel.app", // 현재 프론트엔드 주소
  "http://localhost:5173",
  "http://localhost:3000"
];

// 2. Helmet 설정 수정: API 서버이므로 너무 엄격한 정책은 완화합니다.
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // API 서버에서는 보통 꺼두어도 무방합니다.
}));

// 3. CORS 설정: 명시적인 목록을 사용합니다.
app.use(cors({ 
  origin: (origin, callback) => {
    // origin이 없거나(같은 도메인) 목록에 포함되어 있으면 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true 
}));

app.use(
  (pinoHttp as any)({
    logger,
    serializers: {
      req(req: any) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res: any) { return { statusCode: res.statusCode }; },
    },
  })
);

app.use(express.json({ limit: "1mb" }));

// 모든 API는 /api 경로를 통해 라우팅됩니다.
(app as any).use("/api", router);

export default app;
