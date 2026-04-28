import app from "./app";
import { logger } from "./lib/logger";

// Vercel Serverless 환경: export default로 앱을 내보냄
export default app;

// 로컬 개발 환경: PORT가 있으면 직접 listen
if (process.env.PORT) {
  const port = Number(process.env.PORT);
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}
