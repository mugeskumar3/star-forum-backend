import { Middleware, ExpressErrorMiddlewareInterface } from "routing-controllers";
import { Request, Response, NextFunction } from "express";

@Middleware({ type: "after" })
export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {
    error(error: any, request: Request, response: Response, next: NextFunction) {
        console.error("Global error handler:", error);

        if (error.code === "LIMIT_FILE_SIZE") {
            return response.status(413).json({
                success: false,
                message: "File too large"
            });
        }

        if (error.message?.includes("Unexpected end of form")) {
            return response.status(400).json({
                success: false,
                message: "Incomplete file upload. Please check your file and try again."
            });
        }

        const status = error.httpCode || error.statusCode || 500;
        const responseData: any = {
            success: false,
            message: error.message || "Internal server error"
        };

        if (error.errors) {
            responseData.errors = error.errors;
        }

        response.status(status).json(responseData);
    }
}