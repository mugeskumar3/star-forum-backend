import {
    JsonController,
    Post,
    Body,
    Req,
    Res,
    HttpCode
} from "routing-controllers";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import requestIp from "request-ip";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";

import { AppDataSource } from "../../data-source";
import { Admin } from "../../entity/Admin";
import { AdminUser } from "../../entity/AdminUser";
import { LoginHistory } from "../../entity/LoginHistory";
import response from "../../utils/response";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../../config/jwt";

const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any
};

@JsonController("/auth")
export class AuthController {

    private adminRepo = AppDataSource.getMongoRepository(Admin);
    private adminUserRepo = AppDataSource.getMongoRepository(AdminUser);
    private loginHistoryRepo =
        AppDataSource.getMongoRepository(LoginHistory);

    @Post("/login")
    @HttpCode(StatusCodes.OK)
    async login(
        @Body() body: any,
        @Req() req: Request,
        @Res() res: Response
    ) {
        try {
            const { phoneNumber, pin } = body;

            if (!phoneNumber) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "phoneNumber is required"
                );
            }
            if (!pin) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "pin is required"
                );
            }

            const admin =
                (await this.adminRepo.findOne({
                    phoneNumber,
                    isActive: 1,
                    isDelete: 0
                } as any)) ||
                (await this.adminUserRepo.findOne({
                    phoneNumber,
                    isActive: 1,
                    isDelete: 0
                } as any));

            if (!admin) {
                return response(res, StatusCodes.UNAUTHORIZED, "Invalid mobile number");
            }

            // 2️⃣ Validate PIN
            const validPin = await bcrypt.compare(pin, admin.pin);
            if (!validPin) {
                return response(res, StatusCodes.UNAUTHORIZED, "Invalid PIN");
            }

            // 3️⃣ IP Address
            const ipAddress =
                requestIp.getClientIp(req) || "UNKNOWN";

            // 4️⃣ UA Parser (TS SAFE)
            const parser = new UAParser(req.headers["user-agent"] as string);
            const ua = parser.getResult();

            // 5️⃣ Device Name (Physical device)
            let deviceName = "Unknown Device";

            if (ua.device.vendor && ua.device.model) {
                deviceName = `${ua.device.vendor} ${ua.device.model}`; // Android
            } else if (ua.os.name === "iOS") {
                deviceName = "Apple iPhone"; // iOS privacy
            } else if (ua.os.name) {
                deviceName = ua.os.name; // Desktop
            }

            // 6️⃣ Browser / App Name
            const clientType = req.headers["x-client-type"];
            const platform = req.headers["x-platform"];

            let browserName = "Unknown";

            if (clientType === "MOBILE_APP") {
                browserName =
                    platform === "IOS" ? "iOS App" : "Android App";
            } else {
                browserName = ua.browser.name
                    ? `${ua.browser.name}${ua.browser.version ? " " + ua.browser.version : ""}`
                    : "Unknown Browser";
            }

            // 7️⃣ Location
            const geo = geoip.lookup(ipAddress);
            const currentLocation = geo
                ? `${geo.city || ""}, ${geo.region || ""}, ${geo.country || ""}`
                : "Unknown";

            let payload: any;

            if (admin instanceof Admin) {
                payload = {
                    id: admin.id.toString(),
                    phoneNumber: admin.phoneNumber,
                    role: admin.role,
                    userType: "ADMIN"
                };
            } else {
                payload = {
                    id: admin.id.toString(),
                    phoneNumber: admin.phoneNumber,
                    roleId: admin.roleId.toString(),
                    userType: "ADMIN_USER"
                };
            }

            await this.loginHistoryRepo.save({
                userId: admin.id,
                userType: payload.userType,
                userName: admin.name,
                phoneNumber: admin.phoneNumber,
                deviceName,
                browserName,
                currentLocation,
                ipAddress,
                loginfrom:"MOBILE",
                status: "SUCCESS",
                loginAt: new Date()
            });

            // 🔟 Sign JWT
          const token = jwt.sign(payload, JWT_SECRET, options);

            // ✅ Response
            return response(res, StatusCodes.OK, "Login successful", {
                token,
                userType: payload.userType,
                user: {
                    id: admin.id,
                    name: admin.name,
                    phoneNumber: admin.phoneNumber
                }
            });

        } catch (error) {
            console.error(error);
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                "Login failed"
            );
        }
    }
}
