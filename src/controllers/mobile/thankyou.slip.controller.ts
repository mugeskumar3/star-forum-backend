import {
    JsonController,
    Post,
    Put,
    Delete,
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
import { ThankYouSlip } from "../../entity/ThankyouSlip";
import { CreateThankYouSlipDto } from "../../dto/mobile/ThankYouSlip.dto";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/thank-you-slip")
export class ThankyouSlipController {
    private visitorRepo = AppDataSource.getMongoRepository(ThankYouSlip);

    // =========================
    // ✅ CREATE ThankyouSlip
    // =========================
    @Post("/")
    async createThankyouSlip(
        @Body() body: CreateThankYouSlipDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const slip = new ThankYouSlip();

            slip.comments = body.comments;
            slip.thankTo = new ObjectId(body.thankTo);
            slip.businessType = body.businessType;
            slip.referralType = body.referralType;
            slip.amount = body.amount;
            slip.isActive = 1;
            slip.isDelete = 0;
            slip.createdBy = new ObjectId(req.user.userId);
            slip.updatedBy = new ObjectId(req.user.userId);

            const saved = await this.visitorRepo.save(slip);

            return response(
                res,
                StatusCodes.CREATED,
                " created successfully",
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
    async listThankyouSlip(
        @QueryParams() query: any,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        const page = Math.max(Number(query.page) || 0, 0);
        const limit = Math.max(Number(query.limit) || 10, 1);
        const search = query.search?.toString();
        const filterBy = query.filterBy?.toString();
        const userId = new ObjectId(req.user.userId); // logged-in user
        console.log(userId, "userId");

        const match: any = { isDelete: 0 };

        if (search) {
            match.$or = [
                { comments: { $regex: search, $options: "i" } }
            ];
        }
        if (filterBy === "given") {
            match.createdBy = userId;      // slips I gave
        }

        if (filterBy === "received") {
            match.thankTo = userId;        // slips I received
        }


        const pipeline = [
            { $match: match },

            // 🔹 Created By Member (thankedBy)
            {
                $lookup: {
                    from: "member",
                    let: { memberId: "$createdBy" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$memberId"] } } },
                        {
                            $lookup: {
                                from: "businesscategories",
                                localField: "businessCategory",
                                foreignField: "_id",
                                as: "category"
                            }
                        },
                        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 0,
                                fullName: 1,
                                profileImage: 1,
                                businessCategory: "$category.name",
                                companyName: 1
                            }
                        }
                    ],
                    as: "member"
                }
            },
            { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },

            // 🔹 Thank To Member (thankYouTo)
            {
                $lookup: {
                    from: "member",
                    let: { thankToId: "$thankTo" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$thankToId"] } } },
                        {
                            $lookup: {
                                from: "businesscategories",
                                localField: "businessCategory",
                                foreignField: "_id",
                                as: "category"
                            }
                        },
                        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 0,
                                fullName: 1,
                                profileImage: 1,
                                businessCategory: "$category.name",
                                companyName: 1
                            }
                        }
                    ],
                    as: "thankToMember"
                }
            },
            { $unwind: { path: "$thankToMember", preserveNullAndEmptyArrays: true } },

            {
                $project: {
                    businessType: 1,
                    referralType: 1,
                    comments: 1,
                    amount: 1,
                    createdAt: 1,
                    thankedBy: "$member",
                    thankYouTo: "$thankToMember"
                }
            },

            { $sort: { createdAt: -1 } },

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

        const [result] = await this.visitorRepo
            .aggregate(pipeline)
            .toArray();

        const data = result?.data || [];
        const total = result?.meta?.[0]?.total || 0;

        return pagination(total, data, limit, page, res)
    }

}
