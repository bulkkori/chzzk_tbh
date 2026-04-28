// 프론트/백엔드 분리 배포 시: VITE_API_BASE_URL 환경변수에 백엔드 URL 설정
// 예: VITE_API_BASE_URL=https://your-api.vercel.app
const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

export type UploadKind = "image" | "video";

export interface UploadResult {
  objectPath: string;
  url: string;
  contentType: string;
  name: string;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

export async function uploadFile(file: File, kind: UploadKind): Promise<UploadResult> {
  if (kind === "image" && !file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있어요.");
  }
  if (kind === "video" && !file.type.startsWith("video/")) {
    throw new Error("동영상 파일만 업로드할 수 있어요.");
  }
  const limit = kind === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    throw new Error(`파일이 너무 커요. 최대 ${mb}MB까지 가능합니다.`);
  }

  const reqRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!reqRes.ok) throw new Error("업로드 주소를 받지 못했어요.");
  const { uploadURL, objectPath } = (await reqRes.json()) as {
    uploadURL: string;
    objectPath: string;
  };

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("파일 업로드에 실패했어요.");

  const url = `${API_BASE}/storage${objectPath}`;
  return { objectPath, url, contentType: file.type, name: file.name };
}
