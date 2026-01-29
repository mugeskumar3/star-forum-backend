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
    UseBefore,
    Patch
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
import { CreateThankYouSlipDto, UpdateThankYouSlipRatingDto } from "../../dto/mobile/ThankYouSlip.dto";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/thank-you-slip")
export class ThankyouSlipController {
    private thankyouRepo = AppDataSource.getMongoRepository(ThankYouSlip);

    @Post("/")
    async createThankyouSlip(
        @Body() body: CreateThankYouSlipDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const slip = new ThankYouSlip();

            // slip.comments = body.comments;
            slip.thankTo = new ObjectId(body.thankTo);
            slip.businessType = body.businessType;
            slip.referralType = body.referralType;
            slip.amount = body.amount;
            slip.isActive = 1;
            slip.isDelete = 0;
            slip.createdBy = new ObjectId(req.user.userId);
            slip.updatedBy = new ObjectId(req.user.userId);

            const saved = await this.thankyouRepo.save(slip);

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
        const userId = new ObjectId(req.user.userId);
        console.log(userId, "userId");

        const match: any = { isDelete: 0 };

        if (search) {
            match.$or = [
                { comments: { $regex: search, $options: "i" } }
            ];
        }
        if (filterBy === "given") {
            match.createdBy = userId;
        }

        if (filterBy === "received") {
            match.thankTo = userId;
        }


        const pipeline = [
            { $match: match },
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
                    ratings: 1,
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

        const [result] = await this.thankyouRepo
            .aggregate(pipeline)
            .toArray();

        const data = result?.data || [];
        const total = result?.meta?.[0]?.total || 0;

        return pagination(total, data, limit, page, res)
    }
    @Patch("/ratings/:id")
    async updateThankyouSlipRating(
        @Req() req: any,
        @Param("id") id: string,
        @Body() body: UpdateThankYouSlipRatingDto,
        @Res() res: Response
    ) {
        try {
            const thankyouId = new ObjectId(id);
            const userId = new ObjectId(req.user.userId);

            const thankyou = await this.thankyouRepo.findOne({
                where: {
                    _id: thankyouId,
                    isDelete: 0
                }
            });

            if (!thankyou) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Thank you slip not found"
                );
            }

            if (
                !thankyou.thankTo.equals(userId) &&
                !thankyou.createdBy.equals(userId)
            ) {
                return response(
                    res,
                    StatusCodes.FORBIDDEN,
                    "You are not allowed to update this thank you slip"
                );
            }

            await this.thankyouRepo.updateOne(
                { _id: thankyouId },
                {
                    $set: {
                        ratings: body.ratings,
                        comments: body.comments,
                        updatedAt: new Date()
                    }
                }
            );
            return response(
                res,
                StatusCodes.OK,
                "Thank you slip rating updated successfully"
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
}
