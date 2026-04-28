import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Vercel 환경 변수를 API 클라이언트에 설정합니다.
setBaseUrl(import.meta.env.VITE_API_BASE_URL);

createRoot(document.getElementById("root")!).render(<App />);
