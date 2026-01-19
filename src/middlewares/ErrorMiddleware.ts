// // middlewares/ErrorMiddleware.ts
// import { Middleware, ExpressErrorMiddlewareInterface } from "routing-controllers";

// @Middleware({ type: "after" })
// export class ErrorHandlerMiddleware implements ExpressErrorMiddlewareInterface {
//   error(error: any, request: any, response: any, next: (err: any) => any) {
//     console.error("Global error handler:", error);

//     if (error.code === "LIMIT_FILE_SIZE") {
//       return response.status(413).json({
//         success: false,
//         message: "File too large"
//       });
//     }

//     if (error.message?.includes("Unexpected end of form")) {
//       return response.status(400).json({
//         success: false,
//         message: "Incomplete file upload. Please check your file and try again."
//       });
//     }

//     response.status(error.httpCode || 500).json({
//       success: false,
//       message: error.message || "Internal server error"
//     });
//   }
// }