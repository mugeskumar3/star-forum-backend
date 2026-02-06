import {
    JsonController,
    Post,
    Body,
    Req,
    Res,
    HttpCode,
    Get,
    UseBefore,
    QueryParams
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
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { ObjectId } from "mongodb";
import { pagination } from "../../utils";

const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any
};
interface RequestWithUser extends Request {
    user: AuthPayload;
}
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
                loginfrom: "WEB",
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
    @Get("/profile")
    @UseBefore(AuthMiddleware)
    async getCurrentProfile(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {

            const { userId, userType } = req.user!;

            let data: any[] = [];

            if (userType === "ADMIN") {
                data = await this.adminRepo.aggregate([
                    {
                        $match: {
                            _id: new ObjectId(userId),
                            isActive: 1,
                            isDelete: 0
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            phoneNumber: 1,
                            email: 1,
                            userType: { $literal: "ADMIN" },
                            role: { $literal: null },
                            permissions: { $literal: [] }
                        }
                    }
                ]).toArray();

            }
            else {

                data = await this.adminUserRepo.aggregate([
                    {
                        $match: {
                            _id: new ObjectId(userId),
                            isActive: 1,
                            isDelete: 0
                        }
                    },

                    {
                        $lookup: {
                            from: "roles",
                            localField: "roleId",
                            foreignField: "_id",
                            as: "role"
                        }
                    },
                    { $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },
                    {
                        $lookup: {
                            from: "modules",
                            localField: "role.permissions.moduleId",
                            foreignField: "_id",
                            as: "modules"
                        }
                    },

                    {
                        $addFields: {
                            permissions: {
                                $map: {
                                    input: "$role.permissions",
                                    as: "perm",
                                    in: {
                                        moduleId: "$$perm.moduleId",
                                        moduleName: {
                                            $let: {
                                                vars: {
                                                    module: {
                                                        $arrayElemAt: [
                                                            {
                                                                $filter: {
                                                                    input: "$modules",
                                                                    as: "m",
                                                                    cond: {
                                                                        $eq: ["$$m._id", "$$perm.moduleId"]
                                                                    }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    }
                                                },
                                                in: "$$module.name"
                                            }
                                        },
                                        actions: "$$perm.actions"
                                    }
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            phoneNumber: 1,
                            email: 1,
                            userType: { $literal: "ADMIN_USER" },

                            role: {
                                id: "$role._id",
                                name: "$role.name",
                                code: "$role.code"
                            },

                            permissions: 1
                        }
                    }
                ]).toArray();

            }

            if (!data.length) {
                return response(res, StatusCodes.NOT_FOUND, "User not found");
            }

            const profile = data[0];

            return response(
                res,
                StatusCodes.OK,
                "Profile fetched successfully",
                {
                    id: profile._id,
                    name: profile.name,
                    phoneNumber: profile.phoneNumber,
                    email: profile.email,
                    userType: profile.userType,
                    role: profile.role,
                    permissions: profile.permissions || []
                }
            );

        } catch (error) {
            console.error(error);
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                "Failed to fetch profile"
            );
        }
    }
    @Get("/login-report")
    @UseBefore(AuthMiddleware)
    async getLoginReport(
        @QueryParams() query: any,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {

            const page = Number(query.page ?? 0);
            const limit = Number(query.limit ?? 10);
            const search = req.query.search?.toString();

            const match: any = {};

            if (query.loginfrom) {
                match.loginfrom = query.loginfrom; // WEB / MOBILE
            }

            if (query.userType) {
                match.userType = query.userType; // ADMIN / ADMIN_USER / MEMBER
            }

            if (query.status) {
                match.status = query.status;
            }

            const pipeline: any[] = [
                { $match: match },
                { $sort: { loginAt: -1 } },

                {
                    $project: {
                        _id: 1,
                        userName: 1,
                        phoneNumber: 1,
                        userType: 1,
                        deviceName: 1,
                        browserName: 1,
                        currentLocation: 1,
                        ipAddress: 1,
                        loginfrom: 1,
                        status: 1,
                        loginAt: 1
                    }
                },
                ...(search ? [{
                    $match: {
                        $or: [
                            { userName: { $regex: search, $options: "i" } },
                            { currentLocation: { $regex: search, $options: "i" } },
                            { phoneNumber: { $regex: search, $options: "i" } }
                        ]
                    }
                }] : []),
            ];

            if (limit > 0) {
                pipeline.push(
                    { $skip: page * limit },
                    { $limit: limit }
                );
            }

            const data =
                await this.loginHistoryRepo
                    .aggregate(pipeline)
                    .toArray();

            const totalCount =
                await this.loginHistoryRepo.countDocuments(match);

            return pagination(
                totalCount,
                data,
                limit,
                page,
                res
            );

        } catch (error) {
            console.error(error);
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                "Failed to fetch login report"
            );
        }
    }

}
