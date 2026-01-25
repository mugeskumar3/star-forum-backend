import {
    Post,
    Body,
    Req,
    Res,
    UseBefore,
    JsonController,
    Put,
    Param,
    Get,
    Delete
} from "routing-controllers";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { AppDataSource } from "../../data-source";
import { ChiefGuest } from "../../entity/ChiefGuest";
import { CreateChiefGuestDto } from "../../dto/admin/ChiefGuest.dto";
import { handleErrorResponse, pagination, response } from "../../utils";

interface RequestWithUser extends Request {
    query: any;
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/chief-guest")
export class ChiefGuestController {

    private chiefGuestRepository =
        AppDataSource.getMongoRepository(ChiefGuest);

    // --------------------------------------------------
    // CREATE CHIEF GUEST
    // --------------------------------------------------
    @Post("/create")
    async createChiefGuest(
        @Req() req: RequestWithUser,
        @Body() body: CreateChiefGuestDto,
        @Res() res: Response
    ) {
        try {

            const chiefGuest = new ChiefGuest();

            chiefGuest.chiefGuestName = body.chiefGuestName;
            chiefGuest.contactNumber = body.contactNumber;
            chiefGuest.emailId = body.emailId;
            chiefGuest.businessName = body.businessName;
            chiefGuest.businessCategory = new ObjectId(body.businessCategory);
            chiefGuest.location = body.location;
            chiefGuest.referredBy = new ObjectId(body.referredBy);
            chiefGuest.address = body.address;

            chiefGuest.isActive = body.isActive ?? 1;
            chiefGuest.isDelete = 0;
            chiefGuest.createdBy = new ObjectId(req.user.userId);
            chiefGuest.createdAt = new Date();

            await this.chiefGuestRepository.save(chiefGuest);

            return response(
                res,
                StatusCodes.CREATED,
                "Chief Guest created successfully",
                chiefGuest
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }
    // --------------------------------------------------
    // UPDATE CHIEF GUEST
    // --------------------------------------------------
    @Put("/edit/:id")
    async editChiefGuest(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Body() body: CreateChiefGuestDto,
        @Res() res: Response
    ) {
        try {

            const chiefGuest = await this.chiefGuestRepository.findOne({
                where: {
                    _id: new ObjectId(id),
                    isDelete: 0
                }
            });

            if (!chiefGuest) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Chief Guest not found"
                );
            }

            // -----------------------------
            // UPDATE FIELDS (ONLY IF SENT)
            // -----------------------------
            if (body.chiefGuestName)
                chiefGuest.chiefGuestName = body.chiefGuestName;

            if (body.contactNumber)
                chiefGuest.contactNumber = body.contactNumber;

            if (body.emailId)
                chiefGuest.emailId = body.emailId;

            if (body.businessName)
                chiefGuest.businessName = body.businessName;

            if (body.businessCategory)
                chiefGuest.businessCategory = new ObjectId(body.businessCategory);

            if (body.location)
                chiefGuest.location = body.location;

            if (body.referredBy)
                chiefGuest.referredBy = new ObjectId(body.referredBy);

            if (body.address)
                chiefGuest.address = body.address;

            if (body.isActive !== undefined)
                chiefGuest.isActive = body.isActive;

            // SYSTEM
            chiefGuest.updatedBy = new ObjectId(req.user.userId);
            chiefGuest.updatedAt = new Date();

            await this.chiefGuestRepository.save(chiefGuest);

            return response(
                res,
                StatusCodes.OK,
                "Chief Guest updated successfully",
                chiefGuest
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }

    // --------------------------------------------------
    // LIST CHIEF GUESTS
    // --------------------------------------------------
    @Get("/list")
    async listChiefGuests(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);

            const businessCategory = req.query.businessCategory?.toString();
            const referredBy = req.query.referredBy?.toString();
            const isActive = req.query.isActive?.toString();
            const search = req.query.search?.toString();

            // -------------------------
            // MATCH
            // -------------------------
            const match: any = { isDelete: 0 };

            if (businessCategory)
                match.businessCategory = new ObjectId(businessCategory);

            if (referredBy)
                match.referredBy = new ObjectId(referredBy);

            if (isActive !== undefined)
                match.isActive = Number(isActive);

            if (search) {
                match.$or = [
                    { chiefGuestName: { $regex: search, $options: "i" } },
                    { contactNumber: { $regex: search, $options: "i" } },
                    { emailId: { $regex: search, $options: "i" } },
                    { businessName: { $regex: search, $options: "i" } }
                ];
            }

            const pipeline = [
                { $match: match },

                // -------------------------
                // LOOKUPS
                // -------------------------
                {
                    $lookup: {
                        from: "business_categories",
                        localField: "businessCategory",
                        foreignField: "_id",
                        as: "businessCategory"
                    }
                },
                {
                    $unwind: {
                        path: "$businessCategory",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "users",
                        localField: "referredBy",
                        foreignField: "_id",
                        as: "referredBy"
                    }
                },
                {
                    $unwind: {
                        path: "$referredBy",
                        preserveNullAndEmptyArrays: true
                    }
                },

                // -------------------------
                // SHAPE RESPONSE
                // -------------------------
                {
                    $project: {
                        _id: 1,
                        chiefGuestName: 1,
                        contactNumber: 1,
                        emailId: 1,
                        businessName: 1,
                        location: 1,
                        address: 1,
                        isActive: 1,
                        createdAt: 1,

                        businessCategoryName: "$businessCategory.name",
                        referredByName: "$referredBy.fullName"
                    }
                },

                { $sort: { createdAt: -1 } },

                // -------------------------
                // PAGINATION
                // -------------------------
                {
                    $facet: {
                        data: [
                            { $skip: page * limit },
                            { $limit: limit }
                        ],
                        meta: [{ $count: "total" }]
                    }
                }
            ];

            const result =
                await this.chiefGuestRepository.aggregate(pipeline).toArray();

            const data = result[0]?.data || [];
            const total = result[0]?.meta[0]?.total || 0;

            return pagination(total, data, limit, page, res);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    // --------------------------------------------------
    // CHIEF GUEST DETAILS
    // --------------------------------------------------
    @Get("/details/:id")
    async chiefGuestDetails(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid chief guest id"
                );
            }

            const pipeline = [
                {
                    $match: {
                        _id: new ObjectId(id),
                        isDelete: 0
                    }
                },

                // -------------------------
                // LOOKUPS
                // -------------------------
                {
                    $lookup: {
                        from: "business_categories",
                        localField: "businessCategory",
                        foreignField: "_id",
                        as: "businessCategory"
                    }
                },
                {
                    $unwind: {
                        path: "$businessCategory",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $lookup: {
                        from: "users",
                        localField: "referredBy",
                        foreignField: "_id",
                        as: "referredBy"
                    }
                },
                {
                    $unwind: {
                        path: "$referredBy",
                        preserveNullAndEmptyArrays: true
                    }
                },

                // -------------------------
                // RESPONSE SHAPE
                // -------------------------
                {
                    $project: {
                        isDelete: 0,
                        "businessCategory.isDelete": 0,
                        "referredBy.password": 0
                    }
                }
            ];

            const result = await this.chiefGuestRepository
                .aggregate(pipeline)
                .toArray();

            if (!result.length) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Chief Guest not found"
                );
            }

            return response(
                res,
                StatusCodes.OK,
                "Chief Guest details fetched successfully",
                result[0]
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }
    // --------------------------------------------------
    // DELETE CHIEF GUEST (SOFT DELETE)
    // --------------------------------------------------
    @Delete("/delete/:id")
    async deleteChiefGuest(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid chief guest id"
                );
            }

            const chiefGuest = await this.chiefGuestRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!chiefGuest) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Chief Guest not found"
                );
            }

            chiefGuest.isDelete = 1;
            chiefGuest.updatedAt = new Date();
            chiefGuest.updatedBy = new ObjectId(req.user.userId);

            await this.chiefGuestRepository.save(chiefGuest);

            return response(
                res,
                StatusCodes.OK,
                "Chief Guest deleted successfully"
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }

}
