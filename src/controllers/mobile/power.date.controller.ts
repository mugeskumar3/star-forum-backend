import {
    JsonController,
    Post,
    Get,
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
import { PowerDate } from "../../entity/PowerDate";
import { CreatePowerDateDto } from "../../dto/mobile/PowerDate.dto";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/power-date")
export class PowerDateController {
    private powerDateRepo = AppDataSource.getMongoRepository(PowerDate);

    // =========================
    // ✅ CREATE Power Date
    // =========================
    @Post("/")
    async createPowerDate(
        @Body() body: CreatePowerDateDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const powerDate = new PowerDate();

            powerDate.members = body.members.map(id => new ObjectId(id));
            powerDate.meetingStatus = body.meetingStatus;
            powerDate.name = body.name;
            powerDate.phoneNumber = body.phoneNumber;
            powerDate.email = body.email;
            powerDate.address = body.address;
            powerDate.rating = body.rating;
            powerDate.comments = body.comments;

            powerDate.isActive = 1;
            powerDate.isDelete = 0;
            powerDate.createdBy = new ObjectId(req.user.userId);
            powerDate.updatedBy = new ObjectId(req.user.userId);

            const saved = await this.powerDateRepo.save(powerDate);

            return response(
                res,
                StatusCodes.CREATED,
                "Created successfully",
                saved
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    // =========================
    // ✅ LIST Power Date
    // =========================
    @Get("/list")
    async listPowerDate(
        @QueryParams() query: any,
        @Res() res: Response
    ) {
        const page = Math.max(Number(query.page) || 0, 0);
        const limit = Math.max(Number(query.limit) || 10, 1);
        const search = query.search?.toString();

        const match: any = { isDelete: 0 };

        if (search) {
            match.$or = [
                { name: { $regex: search, $options: "i" } },
                { comments: { $regex: search, $options: "i" } }
            ];
        }

        const pipeline = [
            { $match: match },

            // 🔹 Created By Member
            {
                $lookup: {
                    from: "member",
                    let: { memberId: "$createdBy" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$memberId"] } } },
                        {
                            $project: {
                                _id: 0,
                                fullName: 1,
                                profileImage: 1
                            }
                        }
                    ],
                    as: "createdByMember"
                }
            },
            { $unwind: { path: "$createdByMember", preserveNullAndEmptyArrays: true } },

            // 🔹 Members Lookup (Array)
            {
                $lookup: {
                    from: "member",
                    let: { memberIds: "$members" },
                    pipeline: [
                        { $match: { $expr: { $in: ["$_id", "$$memberIds"] } } },
                        {
                            $project: {
                                fullName: 1,
                                profileImage: 1
                            }
                        }
                    ],
                    as: "memberDetails"
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

        const [result] = await this.powerDateRepo
            .aggregate(pipeline)
            .toArray();

        const data = result?.data || [];
        const total = result?.meta?.[0]?.total || 0;

        return pagination(total, data, limit, page, res);
    }
}
