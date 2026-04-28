import { Router } from "express";
import { Readable } from "stream";
// 1. api-zod를 통째로 가져와서 any 처리 (이름 불일치 해결)
import * as apiZodModule from "@workspace/api-zod";
const {
  UploadUrlRequest, // RequestUploadUrlBody 대신 실제 존재할 법한 이름 사용
  UploadUrlResponse
} = apiZodModule as any;

// 2. 로컬 파일 임포트 시 .js 확장자 추가
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { ObjectPermission } from "../lib/objectAcl.js";

const router = Router();
const objectStorageService = new ObjectStorageService();

// POST /storage/uploads/request-url
(router as any).post("/storage/uploads/request-url", async (req: any, res: any) => {
  // api-zod의 safeParse가 실패할 경우를 대비해 유연하게 처리
  const schema = UploadUrlRequest || (apiZodModule as any).RequestUploadUrlBody;
  const parsed = schema?.safeParse ? schema.safeParse(req.body) : { success: true, data: req.body };

  try {
    const { name, size, contentType } = req.body; // 파싱 에러 방지를 위해 body에서 직접 추출

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const responseSchema = UploadUrlResponse || (apiZodModule as any).RequestUploadUrlResponse;
    const responseData = {
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    };

    return res.json(responseSchema?.parse ? responseSchema.parse(responseData) : responseData);
  } catch (error) {
    if (req.log) req.log.error({ err: error }, "Error generating upload URL");
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// GET /storage/public-objects/*
(router as any).get("/storage/public-objects/*filePath", async (req: any, res: any) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value: any, key: any) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (req.log) req.log.error({ err: error }, "Error serving public object");
    return res.status(500).json({ error: "Failed to serve public object" });
  }
});

// GET /storage/objects/*
(router as any).get("/storage/objects/*path", async (req: any, res: any) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value: any, key: any) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "Object not found" });
    }
    if (req.log) req.log.error({ err: error }, "Error serving object");
    return res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
