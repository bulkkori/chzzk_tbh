import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react"; // 추가
import App from "./App";
import "./index.css";

// Vercel에 설정한 환경 변수를 API 클라이언트에 등록합니다.
setBaseUrl(import.meta.env.VITE_API_BASE_URL); // 추가

createRoot(document.getElementById("root")!).render(<App />);
