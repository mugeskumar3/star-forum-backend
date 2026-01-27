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
import { LoginHistory } from "../../entity/LoginHistory";
import response from "../../utils/response";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../../config/jwt";
import { Member } from "../../entity/Member";

const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any
};

@JsonController("/auth")
export class AuthController {

    private memberRepo = AppDataSource.getMongoRepository(Member);
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
            const member = await this.memberRepo.findOne({
                isActive: 1,
                isDelete: 0,
                mobileNumber: phoneNumber
            } as any);

            if (!member) {
                return response(res, StatusCodes.UNAUTHORIZED, "Invalid mobile number");
            }

            const validPin = await bcrypt.compare(pin, member.pin);
            if (!validPin) {
                return response(res, StatusCodes.UNAUTHORIZED, "Invalid PIN");
            }

            // 3️⃣ IP Address
            const ipAddress =
                requestIp.getClientIp(req) || "UNKNOWN";

            const parser = new UAParser(req.headers["user-agent"] as string);
            const ua = parser.getResult();
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

            if (member instanceof Member) {
                payload = {
                    id: member.id.toString(),
                    phoneNumber: member.mobileNumber,
                    // role: member.role,
                    userType: "MEMBER"
                };
            }

            await this.loginHistoryRepo.save({
                userId: member.id,
                userType: payload.userType,
                userName: member.fullName,
                phoneNumber: member.mobileNumber,
                deviceName,
                browserName,
                currentLocation,
                ipAddress,
                loginfrom: "MOBILE",
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
                    id: member.id,
                    name: member.fullName,
                    phoneNumber: member.mobileNumber,
                    companyName: member.companyName
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
