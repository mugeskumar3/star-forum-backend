import { JsonController, Post, Get, Put, Delete, Param, Body, Res, HttpCode, QueryParams } from "routing-controllers";
import { Response } from "express";
import { AppDataSource } from "../data-source";
import { Admin } from "../entity/Admin";
import { ObjectId } from "mongodb";
import response from "../utils/response";
import handleErrorResponse from "../utils/commonFunction";
import pagination from "../utils/pagination";
import { StatusCodes } from "http-status-codes";

@JsonController("/admin")
export class AdminController {
    private adminRepository = AppDataSource.getMongoRepository(Admin);

    @Post("/")
    @HttpCode(201)
    async createAdmin(@Body() adminData: any, @Res() res: Response) {
        try {
            if (!adminData.name || !adminData.email || !adminData.companyName ||
                !adminData.phoneNumber || !adminData.pin || !adminData.roleId) {
                return response(res, StatusCodes.BAD_REQUEST, "Missing required fields");
            }

            const admin = new Admin();
            admin.name = adminData.name;
            admin.email = adminData.email;
            admin.companyName = adminData.companyName;
            admin.phoneNumber = adminData.phoneNumber;
            admin.pin = adminData.pin;
            admin.roleId = new ObjectId(adminData.roleId);
            admin.isActive = adminData.isActive !== undefined ? adminData.isActive : 1;
            admin.isDelete = 0;

            const savedAdmin = await this.adminRepository.save(admin);

            return response(res, StatusCodes.CREATED, "Admin created successfully", savedAdmin);
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/")
    async getAllAdmins(@QueryParams() query: any, @Res() res: Response) {
        try {
            const page = query.page !== undefined ? parseInt(query.page) : 0;
            const limit = query.limit !== undefined ? parseInt(query.limit) : 10;

            if (query.page !== undefined && query.limit !== undefined) {
                const skip = page * limit;
                const [admins, totalCount] = await this.adminRepository.findAndCount({
                    where: { isDelete: 0 },
                    skip: skip,
                    take: limit
                });

                return pagination(totalCount, admins, limit, page, res);
            } else {
                const admins = await this.adminRepository.find({
                    where: { isDelete: 0 }
                });

                return response(res, StatusCodes.OK, "Admins fetched successfully", admins);
            }
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/active")
    async getActiveAdmins(@Res() res: Response) {
        try {
            const admins = await this.adminRepository.find({
                where: {
                    isDelete: 0,
                    isActive: 1
                }
            });

            return response(res, StatusCodes.OK, "Active admins fetched successfully", admins);
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/:id")
    async getAdminById(@Param("id") id: string, @Res() res: Response) {
        try {
            const admin = await this.adminRepository.findOne({
                where: {
                    _id: new ObjectId(id) as any,
                    isDelete: 0
                }
            });

            if (!admin) {
                return response(res, StatusCodes.NOT_FOUND, "Admin not found");
            }

            return response(res, StatusCodes.OK, "Admin fetched successfully", admin);
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Put("/:id")
    async updateAdmin(@Param("id") id: string, @Body() adminData: any, @Res() res: Response) {
        try {
            const admin = await this.adminRepository.findOne({
                where: {
                    _id: new ObjectId(id) as any,
                    isDelete: 0
                }
            });

            if (!admin) {
                return response(res, StatusCodes.NOT_FOUND, "Admin not found");
            }

            if (adminData.name) admin.name = adminData.name;
            if (adminData.email) admin.email = adminData.email;
            if (adminData.companyName) admin.companyName = adminData.companyName;
            if (adminData.phoneNumber) admin.phoneNumber = adminData.phoneNumber;
            if (adminData.pin) admin.pin = adminData.pin;
            if (adminData.roleId) admin.roleId = new ObjectId(adminData.roleId);
            if (adminData.isActive !== undefined) admin.isActive = adminData.isActive;

            const updatedAdmin = await this.adminRepository.save(admin);

            return response(res, StatusCodes.OK, "Admin updated successfully", updatedAdmin);
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Delete("/:id")
    async deleteAdmin(@Param("id") id: string, @Res() res: Response) {
        try {
            const admin = await this.adminRepository.findOne({
                where: {
                    _id: new ObjectId(id) as any,
                    isDelete: 0
                }
            });

            if (!admin) {
                return response(res, StatusCodes.NOT_FOUND, "Admin not found");
            }

            admin.isDelete = 1;
            await this.adminRepository.save(admin);

            return response(res, StatusCodes.OK, "Admin deleted successfully");
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Put("/:id/toggle-active")
    async toggleActiveStatus(@Param("id") id: string, @Res() res: Response) {
        try {
            const admin = await this.adminRepository.findOne({
                where: {
                    _id: new ObjectId(id) as any,
                    isDelete: 0
                }
            });

            if (!admin) {
                return response(res, StatusCodes.NOT_FOUND, "Admin not found");
            }

            admin.isActive = admin.isActive === 1 ? 0 : 1;
            const updatedAdmin = await this.adminRepository.save(admin);

            return response(res, StatusCodes.OK, `Admin ${admin.isActive === 1 ? 'activated' : 'deactivated'} successfully`, updatedAdmin);
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/role/:roleId")
    async getAdminsByRole(@Param("roleId") roleId: string, @Res() res: Response) {
        try {
            const admins = await this.adminRepository.find({
                where: {
                    roleId: new ObjectId(roleId) as any,
                    isDelete: 0
                }
            });

            return response(res, StatusCodes.OK, "Admins fetched successfully", admins);
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }
}
