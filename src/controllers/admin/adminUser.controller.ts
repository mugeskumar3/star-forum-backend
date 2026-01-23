import {
    JsonController,
    Post,
    Get,
    Put,
    Delete,
    Param,
    Body,
    Res,
    HttpCode,
    QueryParams,
    UseBefore,
    Req
} from "routing-controllers";
import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { AdminUser } from "../../entity/AdminUser";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { CreateAdminUserDto, UpdateAdminUserDto } from "../../dto/admin/AdminUser.dto";
import { AuthPayload } from "../../middlewares/AuthMiddleware";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/adminUser")
export class AdminUserController {
    private adminUserRepository = AppDataSource.getMongoRepository(AdminUser);

    @Post("/")
    async createAdminUser(
        @Body() body: CreateAdminUserDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const existingUser = await this.adminUserRepository.findOneBy({
                phoneNumber: body.phoneNumber,
                isDelete: 0
            });

            if (existingUser) {
                return response(
                    res,
                    StatusCodes.CONFLICT,
                    "Mobile number already exists"
                );
            }

            const adminUser = new AdminUser();
            adminUser.name = body.name;
            adminUser.email = body.email;
            adminUser.companyName = body.companyName;
            adminUser.phoneNumber = body.phoneNumber;
            adminUser.pin = await bcrypt.hash(body.pin, 10);
            adminUser.roleId = new ObjectId(body.roleId);
            adminUser.createdBy = new ObjectId(req.user.userId);
            adminUser.updatedBy = new ObjectId(req.user.userId);
            adminUser.isActive = body.isActive ?? 1;
            adminUser.isDelete = 0;

            const savedAdminUser = await this.adminUserRepository.save(adminUser);

            return response(
                res,
                StatusCodes.CREATED,
                "AdminUser created successfully",
                savedAdminUser
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/")
    async getAllAdminUsers(
        @QueryParams() query: any,
        @Res() res: Response
    ) {
        try {
            const page = Number(query.page ?? 0);
            const limit = Number(query.limit ?? 0);
            const match: any = {
                isDelete: 0
            };

            if (query.status !== undefined) {
                match.isActive = Number(query.status);
            }
            const operation: any[] = [];
            operation.push({ $match: match });
            operation.push({
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
                                name: 1
                            }
                        }
                    ],
                    as: "role"
                }
            });
            operation.push({
                $unwind: {
                    path: "$role",
                    preserveNullAndEmptyArrays: true
                }
            });

            if (limit > 0) {
                operation.push(
                    { $skip: page * limit },
                    { $limit: limit }
                );
            }

            operation.push({
                $project: {
                    name: 1,
                    email: 1,
                    companyName: 1,
                    phoneNumber: 1,
                    isActive: 1,
                    roleId: 1,
                    roleName: "$role.name",
                    createdAt: 1
                }
            });

            const result = await this.adminUserRepository
                .aggregate(operation)
                .toArray();

            const Count =
                await this.adminUserRepository.countDocuments(match);

            return pagination(Count, result, limit, page, res);
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/active")
    async getActiveAdminUsers(@Res() res: Response) {
        try {
            const adminUsers = await this.adminUserRepository.find({
                isDelete: 0,
                isActive: 1
            });

            return response(
                res,
                StatusCodes.OK,
                "Active AdminUsers fetched successfully",
                adminUsers
            );
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/:id")
    async getAdminUserById(@Param("id") id: string, @Res() res: Response) {
        try {
            const adminUser = await this.adminUserRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!adminUser) {
                return response(res, StatusCodes.NOT_FOUND, "AdminUser not found");
            }

            return response(
                res,
                StatusCodes.OK,
                "AdminUser fetched successfully",
                adminUser
            );
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Put("/:id")
    async updateAdminUser(
        @Param("id") id: string,
        @Body() body: UpdateAdminUserDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const adminUser = await this.adminUserRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!adminUser) {
                return response(res, StatusCodes.NOT_FOUND, "AdminUser not found");
            }

            if (body.phoneNumber) {
                const mobileExists = await this.adminUserRepository.findOne({
                    where: {
                        phoneNumber: body.phoneNumber,
                        isDelete: 0,
                        _id: { $ne: new ObjectId(id) }
                    }
                });

                if (mobileExists) {
                    return response(
                        res,
                        StatusCodes.CONFLICT,
                        "Mobile number already exists"
                    );
                }

                adminUser.phoneNumber = body.phoneNumber;
            }

            if (body.name) adminUser.name = body.name;
            if (body.email) adminUser.email = body.email;
            if (body.companyName) adminUser.companyName = body.companyName;

            if (body.pin) {
                adminUser.pin = await bcrypt.hash(body.pin, 10);
            }

            if (body.roleId) adminUser.roleId = new ObjectId(body.roleId);
            if (body.isActive !== undefined) adminUser.isActive = body.isActive;

            adminUser.updatedBy = new ObjectId(req.user.userId);

            const updatedAdminUser = await this.adminUserRepository.save(adminUser);

            return response(
                res,
                StatusCodes.OK,
                "AdminUser updated successfully",
                updatedAdminUser
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }


    @Delete("/:id")
    async deleteAdminUser(@Param("id") id: string, @Res() res: Response) {
        try {
            const adminUser = await this.adminUserRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!adminUser) {
                return response(res, StatusCodes.NOT_FOUND, "AdminUser not found");
            }

            adminUser.isDelete = 1;
            await this.adminUserRepository.save(adminUser);

            return response(res, StatusCodes.OK, "AdminUser deleted successfully");
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Put("/:id/toggle-active")
    async toggleActiveStatus(@Param("id") id: string, @Res() res: Response) {
        try {
            const adminUser = await this.adminUserRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!adminUser) {
                return response(res, StatusCodes.NOT_FOUND, "AdminUser not found");
            }

            adminUser.isActive = adminUser.isActive === 1 ? 0 : 1;
            const updatedAdminUser =
                await this.adminUserRepository.save(adminUser);

            return response(
                res,
                StatusCodes.OK,
                `AdminUser ${adminUser.isActive === 1 ? "activated" : "deactivated"
                } successfully`,
                updatedAdminUser
            );
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/role/:roleId")
    async getAdminUsersByRole(
        @Param("roleId") roleId: string,
        @Res() res: Response
    ) {
        try {
            const adminUsers = await this.adminUserRepository.find({
                roleId: new ObjectId(roleId),
                isDelete: 0
            });

            return response(
                res,
                StatusCodes.OK,
                "AdminUsers fetched successfully",
                adminUsers
            );
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }
}
