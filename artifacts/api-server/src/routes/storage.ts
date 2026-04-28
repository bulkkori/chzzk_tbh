import { Router } from "express";
import { Readable } from "stream";
// 1. api-zod 모듈을 any로 가져와 이름 불일치 문제 해결
import * as apiZodModule from "@workspace/api-zod";
const {
  UploadUrlRequest,
  UploadUrlResponse
} = apiZodModule as any;

// 2. 로컬 파일 임포트 시 반드시 .js 확장자 추가
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { ObjectPermission } from "../lib/objectAcl.js";

const router = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 */
(router as any).post("/storage/uploads/request-url", async (req: any, res: any) => {
  const bodySchema = UploadUrlRequest || (apiZodModule as any).RequestUploadUrlBody;
  const parsed = bodySchema?.safeParse ? bodySchema.safeParse(req.body) : { success: true, data: req.body };
  
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing or invalid required fields" });
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const responseSchema = UploadUrlResponse || (apiZodModule as any).RequestUploadUrlResponse;
    const responseData = {
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    };

    return res.json(
      responseSchema?.parse ? responseSchema.parse(responseData) : responseData
    );
  } catch (error) {
    if (req.log) req.log.error({ err: error }, "Error generating upload URL");
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 */
(router as any).get("/storage/public-objects/*filePath", async (req: any, res: any) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // ★ 핵심 수정: 반환값을 any로 받아서 타입 충돌 해결
    const response: any = await objectStorageService.downloadObject(file);

    res.status(response.status);
    if (response.headers && typeof response.headers.forEach === 'function') {
      response.headers.forEach((value: any, key: any) => res.setHeader(key, value));
    }

    if (response.body) {
      // web stream을 node stream으로 변환
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

/**
 * GET /storage/objects/*
 */
(router as any).get("/storage/objects/*path", async (req: any, res: any) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // ★ 핵심 수정: 반환값을 any로 받아서 타입 충돌 해결
    const response: any = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    if (response.headers && typeof response.headers.forEach === 'function') {
      response.headers.forEach((value: any, key: any) => res.setHeader(key, value));
    }

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      if (req.log) req.log.warn({ err: error }, "Object not found");
      return res.status(404).json({ error: "Object not found" });
    }
    if (req.log) req.log.error({ err: error }, "Error serving object");
    return res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
