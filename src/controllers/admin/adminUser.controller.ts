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
    QueryParams
} from "routing-controllers";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AdminUser } from "../../entity/AdminUser";
import { ObjectId } from "mongodb";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { StatusCodes } from "http-status-codes";

@JsonController("/adminUser")
export class AdminUserController {
    private adminUserRepository = AppDataSource.getMongoRepository(AdminUser);

    @Post("/")
    @HttpCode(201)
    async createAdminUser(@Body() adminUserData: any, @Res() res: Response) {
        try {
            const requiredFields = [
                "name",
                "email",
                "companyName",
                "phoneNumber",
                "pin",
                "roleId"
            ];

            for (const field of requiredFields) {
                if (!adminUserData[field]) {
                    return response(res, StatusCodes.BAD_REQUEST, `${field} is required`);
                }
            }

            const adminUser = new AdminUser();
            adminUser.name = adminUserData.name;
            adminUser.email = adminUserData.email;
            adminUser.companyName = adminUserData.companyName;
            adminUser.phoneNumber = adminUserData.phoneNumber;
            adminUser.pin = adminUserData.pin;
            adminUser.roleId = new ObjectId(adminUserData.roleId);
            adminUser.isActive = adminUserData.isActive ?? 1;
            adminUser.isDelete = 0;

            const savedAdminUser = await this.adminUserRepository.save(adminUser);

            return response(
                res,
                StatusCodes.CREATED,
                "AdminUser created successfully",
                savedAdminUser
            );
        } catch (error: any) {
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
            const adminUser = await this.adminUserRepository.findOne({
                _id: new ObjectId(id),
                isDelete: 0
            } as any);

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
        @Body() adminUserData: any,
        @Res() res: Response
    ) {
        try {
            const adminUser = await this.adminUserRepository.findOne({
                _id: new ObjectId(id),
                isDelete: 0
            } as any);

            if (!adminUser) {
                return response(res, StatusCodes.NOT_FOUND, "AdminUser not found");
            }

            if (adminUserData.name) adminUser.name = adminUserData.name;
            if (adminUserData.email) adminUser.email = adminUserData.email;
            if (adminUserData.companyName)
                adminUser.companyName = adminUserData.companyName;
            if (adminUserData.phoneNumber)
                adminUser.phoneNumber = adminUserData.phoneNumber;
            if (adminUserData.pin) adminUser.pin = adminUserData.pin;
            if (adminUserData.roleId)
                adminUser.roleId = new ObjectId(adminUserData.roleId);
            if (adminUserData.isActive !== undefined)
                adminUser.isActive = adminUserData.isActive;

            const updatedAdminUser =
                await this.adminUserRepository.save(adminUser);

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
            const adminUser = await this.adminUserRepository.findOne({
                _id: new ObjectId(id),
                isDelete: 0
            } as any);

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
            const adminUser = await this.adminUserRepository.findOne({
                _id: new ObjectId(id),
                isDelete: 0
            } as any);

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
            } as any);

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
