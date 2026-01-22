import {
    ExpressMiddlewareInterface,
    UnauthorizedError,
    ForbiddenError
} from "routing-controllers";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt";

export interface AuthPayload {
    userId: string;
    role?: string;
    roleId?: string;
    userType?: "ADMIN" | "ADMIN_USER";
}

export class AuthMiddleware implements ExpressMiddlewareInterface {
    use(req: Request, _res: Response, next: NextFunction): void {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                throw new UnauthorizedError("Authorization header missing");
            }

            if (!authHeader.startsWith("Bearer ")) {
                throw new UnauthorizedError("Invalid authorization format");
            }

            const token = authHeader.split(" ")[1];

            if (!token) {
                throw new UnauthorizedError("Token missing");
            }
            const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
            (req as any).user = decoded;
            next();
        } catch (error: any) {
            throw new UnauthorizedError("Invalid or expired token");
        }
    }
}
