import { JsonController, Post, Body, Res, HttpCode } from "routing-controllers";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { Admin } from "../../entity/Admin";
import { AdminUser } from "../../entity/AdminUser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import response from "../../utils/response";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../../config/jwt";

@JsonController("/auth")
export class LoginController {
    private adminRepo = AppDataSource.getMongoRepository(Admin);
    private adminUserRepo = AppDataSource.getMongoRepository(AdminUser);

    @Post("/login")
    @HttpCode(StatusCodes.OK)
    async login(@Body() loginData: any, @Res() res: Response) {
        try {
            const { phoneNumber, pin } = loginData;

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

            const validPin = await bcrypt.compare(pin, admin.pin);
            if (!validPin) {
                return response(res, StatusCodes.UNAUTHORIZED, "Invalid PIN");
            }

            const payload =
                admin instanceof Admin
                    ? {
                        id: admin.id.toString(),
                        mobileNumber: admin.phoneNumber,
                        role: admin.role,
                        userType: "ADMIN"
                    }
                    : {
                        id: admin.id.toString(),
                        mobileNumber: admin.phoneNumber,
                        roleId: admin.roleId.toString(),
                        userType: "ADMIN_USER"
                    };

            const token = jwt.sign(
                payload,
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

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
            return response(res, StatusCodes.INTERNAL_SERVER_ERROR, "Login failed");
        }
    }
}
