import "reflect-metadata";
import express from "express";
import { useExpressServer } from "routing-controllers";
import { AppDataSource } from "./data-source";
import { Admin } from "./entity/Admin";
import { ObjectId } from "mongodb";
import fileUpload from 'express-fileupload';

AppDataSource.initialize()
  .then(async () => {
    console.log("✅ Database connected");

    // Default Admin Creation
    const adminRepo = AppDataSource.getMongoRepository(Admin);
    const count = await adminRepo.countDocuments({ isDelete: 0 });
    if (count === 0) {
      const defaultAdmin = new Admin();
      defaultAdmin.name = "Star Admin";
      defaultAdmin.email = "admin@starforum.in";
      defaultAdmin.companyName = "Star Forum";
      defaultAdmin.phoneNumber = "9988776655";
      defaultAdmin.pin = "2026";
      defaultAdmin.role = "Admin";
      defaultAdmin.isActive = 1;
      defaultAdmin.isDelete = 0;

      await adminRepo.save(defaultAdmin);
      console.log("🌟 Default Admin created: admin@starforum.in / 2026");
    }

    const app = express();
    // Add body parsing middleware with limits to prevent form errors
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(fileUpload({
      limits: { fileSize: 1000 * 1024 * 1024 }, // 10 MB
      abortOnLimit: true,
      useTempFiles: false,
    }));

    // Body parsers
    app.use(express.json({ limit: '1000mb' }));
    app.use(express.urlencoded({ limit: '1000mb', extended: false }));
    // Admin Routes
    useExpressServer(app, {
      routePrefix: "/api/admin",
      controllers: [__dirname + "/controllers/admin/**/*.ts"],
      middlewares: [__dirname + "/middlewares/**/*.ts"],
      defaultErrorHandler: false,
      validation: true,
      classTransformer: true,
    });

    // Mobile Routes
    useExpressServer(app, {
      routePrefix: "/api/mobile",
      controllers: [__dirname + "/controllers/mobile/**/*.ts"],
      middlewares: [__dirname + "/middlewares/**/*.ts"],
      defaultErrorHandler: false,
      validation: true,
      classTransformer: true,
    });
    console.log("MONGO_URI:", process.env.MONGO_URI);
    app.get('/test', (req, res) => {
      console.log("🚀 Server running successfully");

      return res.status(200).json({
        message: "Server running successfully 🚀"
      });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => console.log("❌ DB Error:", error));
