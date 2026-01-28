import {
    JsonController,
    Post,
    Get,
    Param,
    Body,
    Req,
    Res,
    QueryParams,
    UseBefore
} from "routing-controllers";
import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";

import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { MobileChiefGuest } from "../../entity/MobileChiefGuest";
import { CreateMobileChiefGuestDto } from "../../dto/mobile/MobileChiefGuest";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/chief-guest")
export class ChiefGuestController {
    private visitorRepo = AppDataSource.getMongoRepository(MobileChiefGuest);

    // =========================
    // ✅ CREATE VISITOR
    // =========================
    @Post("/")
    async createChief(
        @Body() body: CreateMobileChiefGuestDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const chiefGuest = new MobileChiefGuest();

            chiefGuest.chiefGuestName = body.chiefGuestName;
            chiefGuest.contactNumber = body.contactNumber;
            chiefGuest.businessCategory = body.businessCategory;
            chiefGuest.email = body.email;
            chiefGuest.location = body.location;
            chiefGuest.address = body.address;
            chiefGuest.status = body.status || "MAY_BE";
            chiefGuest.businessName = body.businessName || "";

            chiefGuest.isActive = 1;
            chiefGuest.isDelete = 0;
            chiefGuest.createdBy = new ObjectId(req.user.userId);
            chiefGuest.updatedBy = new ObjectId(req.user.userId);

            const saved = await this.visitorRepo.save(chiefGuest);

            return response(
                res,
                StatusCodes.CREATED,
                "Chief Guest created successfully",
                saved
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    // =========================
    // ✅ LIST VISITORS (AGGREGATION + MEMBER LOOKUP)
    // =========================
    @Get("/list")
    async listChiefGuest(
        @QueryParams() query: any,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(query.page) || 0, 0);
            const limit = Math.max(Number(query.limit) || 10, 1);
            const search = query.search?.toString();

            const match: any = { isDelete: 0 };

            if (search) {
                match.$or = [
                    { chiefGuestName: { $regex: search, $options: "i" } },
                    { contactNumber: { $regex: search, $options: "i" } }
                ];
            }

            const pipeline = [
                { $match: match },

                // 🔹 Lookup member (Invited By)
                {
                    $lookup: {
                        from: "member",
                        localField: "createdBy",
                        foreignField: "_id",
                        as: "member"
                    }
                },
                {
                    $unwind: {
                        path: "$member",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $project: {
                        chiefGuestName: 1,
                        contactNumber: 1,
                        sourceOfEvent: 1,
                        status: 1,
                        businessCategory: 1,
                        businessName: 1,
                        createdAt: 1,
                        email: 1,
                        location: 1,
                        address: 1,
                        invitedBy: {
                            _id: "$member._id",
                            name: "$member.fullName"
                        }
                    }
                },

                { $sort: { createdAt: -1 } },

                {
                    $facet: {
                        data: [
                            { $skip: page },
                            { $limit: limit }
                        ],
                        meta: [{ $count: "total" }]
                    }
                }
            ];

            const [result] = await this.visitorRepo.aggregate(pipeline).toArray();

            const data = result?.data || [];
            const total = result?.meta?.[0]?.total || 0;
            console.log(total, 'total');

            return pagination(total, data, limit, page, res);
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
}
