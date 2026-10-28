import express from "express";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Upload from "../models/upload.model.js";
import { secureRoute } from "../middleware/auth.middleware.js";

export function registerLocalUploads(app) {
  const directory = path.resolve("local-data", "uploads");
  app.use("/local-images", express.static(directory, { dotfiles: "deny" }));
  app.get("/api/upload/signature", secureRoute, async (req, res, next) => {
    try {
      const formId = randomUUID();
      await Upload.create({ formId });
      res.json({ success: true, data: { local: true, formId } });
    } catch (error) { next(error); }
  });
  app.post("/api/upload/local", secureRoute, express.raw({ type: ["image/png", "image/jpeg", "image/webp", "image/gif"], limit: "5mb" }), async (req, res, next) => {
    try {
      const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
      const extension = extensions[req.get("Content-Type")];
      if (!extension || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: "Choose a PNG, JPEG, WebP or GIF image." });
      const upload = await Upload.findOne({ formId: String(req.query.formId), status: "pending" });
      if (!upload) return res.status(400).json({ message: "Invalid upload session" });
      const filename = `${randomUUID()}.${extension}`;
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, filename), req.body);
      upload.public_id = filename;
      upload.secure_url = `http://localhost:${process.env.PORT}/local-images/${filename}`;
      await upload.save();
      res.json({ public_id: upload.public_id, secure_url: upload.secure_url });
    } catch (error) { next(error); }
  });
}
