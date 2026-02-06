import {
    JsonController,
    Post,
    Put,
    Body,
    Req,
    Res,
    HttpCode,
    UseBefore
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
import handleErrorResponse from "../../utils/commonFunction";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../../config/jwt";
import { Member } from "../../entity/Member";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { ChangePasswordDto } from "../../dto/mobile/Auth.dto";
import { ObjectId } from "mongodb";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

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

            const { phoneNumber, pin, deviceToken } = body;

            if (!phoneNumber) {
                return response(res, StatusCodes.BAD_REQUEST, "phoneNumber is required");
            }

            if (!pin) {
                return response(res, StatusCodes.BAD_REQUEST, "pin is required");
            }
            const pipeline: any[] = [

                {
                    $match: {
                        phoneNumber,
                        isActive: 1,
                        isDelete: 0
                    }
                },
                {
                    $lookup: {
                        from: "chapter_role_assignments",
                        let: { memberId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$memberId", "$$memberId"] }
                                }
                            },
                            {
                                $project: {
                                    _id: 0,
                                    chapterId: 1,
                                    roleId: 1
                                }
                            }
                        ],
                        as: "chapterRole"
                    }
                },

                {
                    $unwind: {
                        path: "$chapterRole",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: "roles",
                        let: { roleId: "$chapterRole.roleId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$_id", "$$roleId"] }
                                }
                            },
                            {
                                $project: {
                                    _id: 0,
                                    name: 1,
                                    code: 1
                                }
                            }
                        ],
                        as: "chapterRoleRole"
                    }
                },

                {
                    $unwind: {
                        path: "$chapterRoleRole",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: "roles",
                        let: { roleId: "$roleId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$_id", "$$roleId"] }
                                }
                            },
                            {
                                $project: {
                                    _id: 0,
                                    name: 1,
                                    code: 1
                                }
                            }
                        ],
                        as: "memberRole"
                    }
                },

                {
                    $unwind: {
                        path: "$memberRole",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        _id: 1,
                        fullName: 1,
                        phoneNumber: 1,
                        companyName: 1,
                        pin: 1,

                        roleName: {
                            $ifNull: ["$chapterRoleRole.name", "$memberRole.name"]
                        },

                        roleCode: {
                            $ifNull: ["$chapterRoleRole.code", "$memberRole.code"]
                        }
                    }
                }

            ];

            const users =
                await this.memberRepo.aggregate(pipeline).toArray();

            const member = users[0];

            if (!member) {
                return response(res, StatusCodes.UNAUTHORIZED, "Invalid mobile number");
            }

            const validPin = await bcrypt.compare(pin, member.pin);

            if (!validPin) {
                return response(res, StatusCodes.UNAUTHORIZED, "Invalid PIN");
            }

            const ipAddress = requestIp.getClientIp(req) || "UNKNOWN";

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
            const geo = geoip.lookup(ipAddress);
            const currentLocation = geo
                ? `${geo.city || ""}, ${geo.region || ""}, ${geo.country || ""}`
                : "Unknown";

            const payload = {
                id: member._id.toString(),
                userType: "MEMBER",
                phoneNumber: member.phoneNumber,
                roleCode: member.roleCode
            };

            const token = jwt.sign(payload, JWT_SECRET);

            await this.loginHistoryRepo.save({
                userId: member._id,
                userType: "MEMBER",
                userName: member.fullName,
                phoneNumber: member.phoneNumber,
                deviceName,
                browserName,
                currentLocation,
                ipAddress,
                loginfrom: "MOBILE",
                status: "SUCCESS",
                loginAt: new Date()
            });

            // update device token
            await this.memberRepo.findOneAndUpdate({
                _id: member._id
            }, {
                $set: {
                    deviceToken
                }
            });


            return response(res, StatusCodes.OK, "Login successful", {
                token,
                userType: "MEMBER",
                user: {
                    id: member._id,
                    name: member.fullName,
                    phoneNumber: member.phoneNumber,
                    companyName: member.companyName,
                    roleName: member.roleName,
                    roleCode: member.roleCode
                }
            });

        } catch (error) {
            console.error(error);
            return response(res, StatusCodes.INTERNAL_SERVER_ERROR, "Login failed");
        }
    }

    @UseBefore(AuthMiddleware)
    @Post("/change-password")
    async changePassword(
        @Body() body: ChangePasswordDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const { oldPassword, newPassword, confirmPassword } = body;
            const userId = new ObjectId(req.user.userId);

            if (newPassword !== confirmPassword) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "New password and confirm password do not match"
                );
            }

            const member = await this.memberRepo.findOneBy({
                _id: userId,
                isDelete: 0
            });

            if (!member) {
                return response(res, StatusCodes.NOT_FOUND, "User not found");
            }

            // Verify old password (pin)
            const isMatch = await bcrypt.compare(oldPassword, member.pin);
            if (!isMatch) {
                return response(
                    res,
                    StatusCodes.UNAUTHORIZED,
                    "Incorrect old password"
                );
            }

            // Hash new password
            const hashedPin = await bcrypt.hash(newPassword, 10);
            member.pin = hashedPin;
            member.updatedBy = userId;

            await this.memberRepo.save(member);

            return response(
                res,
                StatusCodes.OK,
                "Password changed successfully"
            );

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
}
