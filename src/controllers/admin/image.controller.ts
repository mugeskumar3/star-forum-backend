import {
    JsonController,
    Post,
    Delete,
    Get,
    UseBefore,
    Param,
    Req,
    Res,
    QueryParam
} from "routing-controllers";

import { StatusCodes } from "http-status-codes";
import * as fs from "fs";
import * as path from "path";
import { response } from "../../utils";
import imageService from "../../utils/upload";

interface RequestWithFiles extends Request {
    query: any;
    files: any;
}

@JsonController("/image")
export class ImageController {

    @Post("/upload")
    async upload(@Req() req: RequestWithFiles, @Res() res: Response) {
        try {
            if (!req.files || !req.files.file) {
                return response(res, StatusCodes.BAD_REQUEST, "No image uploaded");
            }
            if (!req.query.path) {
                return response(res, StatusCodes.BAD_REQUEST, "Path is required!!");
            }
            const file = req.files.file;

            // ✅ Validate & extract extension
            const extension = await imageService.validateImageFile(file);

            // ✅ Generate safe filename
            const fileName = `image_${Date.now()}${extension}`;

            const uploadResult = await imageService.fileUpload(
                file,
                req.query.path,
                fileName,
                ""
            );

            if (!uploadResult) {
                return response(res, StatusCodes.INTERNAL_SERVER_ERROR, "Upload failed");
            }

            return response(res, StatusCodes.CREATED, "Image uploaded successfully", {
                fileName,
                path: `uploads/${fileName}`
            });

        } catch (error: any) {
            return response(
                res,
                StatusCodes.BAD_REQUEST,
                error.message || "File upload error"
            );
        }
    }

    // ---------------------------
    // PREVIEW IMAGE
    // GET /image/view/:fileName
    // ---------------------------
    @Get("/view/:fileName")
    async view(@Param("fileName") fileName: string, @Res() res: Response) {
        try {
            const imgPath = path.join(__dirname, "../../uploads/images", fileName);

            if (!fs.existsSync(imgPath)) {
                return response(res, StatusCodes.NOT_FOUND, "Image not found");
            }

            return response(res, 200, imgPath);

        } catch (error) {
            return response(res, StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    }

    // ---------------------------
    // DELETE IMAGE
    // ---------------------------
    @Delete("/delete")
    async delete(@QueryParam("path") filePath: string, @Res() res: Response) {
        try {
            const imgPath = path.join(process.cwd(), "public", filePath);

            if (!fs.existsSync(imgPath)) {
                return response(res, StatusCodes.NOT_FOUND, "Image not found");
            }

            fs.unlinkSync(imgPath);

            return response(res, StatusCodes.OK, "Image deleted successfully");

        } catch (error) {
            return response(res, StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
    }
}
