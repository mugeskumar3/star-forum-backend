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

            return response(res, StatusCodes.CREATED, "AdminUser created successfully", savedAdminUser);
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }



    @Get("/")
    async getAllAdminUsers(@QueryParams() query: any, @Res() res: Response) {
        try {
            const page = Number(query.page ?? 0);
            const limit = Number(query.limit ?? 10);
            const skip = page * limit;

            const filter = { isDelete: 0 };

            if (query.page !== undefined && query.limit !== undefined) {
                const totalCount =
                    await this.adminUserRepository.countDocuments(filter);

                const adminUsers = await this.adminUserRepository.find({
                    skip,
                    limit,
                    ...filter
                });

                return pagination(totalCount, adminUsers, limit, page, res);
            }

            const adminUsers = await this.adminUserRepository.find(filter);

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
                id: new ObjectId(id),
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
                id: new ObjectId(id),
                isDelete: 0
            });

            if (!adminUser) {
                return response(res, StatusCodes.NOT_FOUND, "AdminUser not found");
            }

            if (body.name) adminUser.name = body.name;
            if (body.email) adminUser.email = body.email;
            if (body.companyName) adminUser.companyName = body.companyName;
            if (body.phoneNumber) adminUser.phoneNumber = body.phoneNumber;

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
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Delete("/:id")
    async deleteAdminUser(@Param("id") id: string, @Res() res: Response) {
        try {
            const adminUser = await this.adminUserRepository.findOneBy({
                id: new ObjectId(id),
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
                id: new ObjectId(id),
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
