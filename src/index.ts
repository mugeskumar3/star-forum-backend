import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { useExpressServer } from "routing-controllers";
import { AppDataSource } from "./data-source";
import fileUpload from "express-fileupload";
import { seedDefaultAdmin } from "./seed/admin";

AppDataSource.initialize()
  .then(async () => {
    console.log("✅ Database connected");
    await seedDefaultAdmin();

    const app = express();

    app.use(
      fileUpload({
        limits: { fileSize: 10 * 1024 * 1024 },
        abortOnLimit: true,
        useTempFiles: false
      })
    );

    useExpressServer(app, {
      routePrefix: "/api/admin",
      controllers: [__dirname + "/controllers/admin/**/*.ts"],
      middlewares: [__dirname + "/middlewares/**/*.ts"],
      defaultErrorHandler: false,
      validation: true,
      classTransformer: true
    });

    useExpressServer(app, {
      routePrefix: "/api/mobile",
      controllers: [__dirname + "/controllers/mobile/**/*.ts"],
      middlewares: [__dirname + "/middlewares/**/*.ts"],
      defaultErrorHandler: false,
      validation: true,
      classTransformer: true
    });

     app.get("/", (_req, res) => {
      res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        database: AppDataSource.isInitialized ? "connected" : "disconnected",
        nodeVersion: process.version,
        uptime: process.uptime()
      });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ DB Error:", error);
  });
