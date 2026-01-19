// controllers/UploadController.ts
import { JsonController, Post, UseBefore, Req, Res } from "routing-controllers";
import { Request, Response } from "express";
import { uploadMiddleware } from "../middlewares/uploadMiddleware";

@JsonController("/upload")
export class UploadController {
  @Post("/")
//   @UseBefore(uploadMiddleware)
  uploadFile(@Req() req: Request, @Res() res: Response) {
    // Files are now in req.files
    // Form fields in req.body

    console.log("Files:", req.files);
    console.log("Body:", req.body);

    return res.json({ message: "File uploaded successfully", files: req.files });
  }
}