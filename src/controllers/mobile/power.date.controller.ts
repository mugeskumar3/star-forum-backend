import {
    JsonController,
    Post,
    Get,
    Body,
    Req,
    Res,
    QueryParams,
    UseBefore,
    Param,
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
import { PowerDate } from "../../entity/PowerDate";
import { Points } from "../../entity/Points";
import { UserPoints } from "../../entity/UserPoints";
import { UserPointHistory } from "../../entity/UserPointHistory";
import { CreatePowerDateDto } from "../../dto/mobile/PowerDate.dto";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/power-date")
export class PowerDateController {
    private powerDateRepo = AppDataSource.getMongoRepository(PowerDate);
    private pointsRepo = AppDataSource.getMongoRepository(Points);
    private userPointsRepo = AppDataSource.getMongoRepository(UserPoints);
    private historyRepo = AppDataSource.getMongoRepository(UserPointHistory);

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

            // --- Points Allocation ---
            const pointConfig = await this.pointsRepo.findOne({
                where: { key: "power_dates", isActive: 1, isDelete: 0 }
            });

            if (pointConfig) {
                const userId = new ObjectId(req.user.userId);

                await this.userPointsRepo.updateOne(
                    { userId, pointKey: "power_dates" },
                    { $inc: { value: pointConfig.value } },
                    { upsert: true }
                );

                await this.historyRepo.save({
                    userId,
                    pointKey: "power_dates",
                    change: pointConfig.value,
                    source: "POWER_DATE",
                    sourceId: saved._id,
                    remarks: "Power Date logged",
                    createdAt: new Date()
                });
            }

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
    @Patch("/:id")
    async updatePowerDate(
        @Param("id") id: string,
        @Body() body: CreatePowerDateDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid PowerDate ID");
            }

            const powerDate = await this.powerDateRepo.findOne({
                where: {
                    _id: new ObjectId(id),
                    isDelete: 0
                }
            });

            if (!powerDate) {
                return response(res, StatusCodes.NOT_FOUND, "PowerDate not found");
            }

            // 🔹 Update fields only if provided
            if (body.members?.length) {
                powerDate.members = body.members.map(id => new ObjectId(id));
            }

            if (body.meetingStatus !== undefined)
                powerDate.meetingStatus = body.meetingStatus;

            if (body.name !== undefined)
                powerDate.name = body.name;

            if (body.phoneNumber !== undefined)
                powerDate.phoneNumber = body.phoneNumber;

            if (body.email !== undefined)
                powerDate.email = body.email;

            if (body.address !== undefined)
                powerDate.address = body.address;

            if (body.rating !== undefined)
                powerDate.rating = body.rating;

            if (body.comments !== undefined)
                powerDate.comments = body.comments;

            powerDate.updatedBy = new ObjectId(req.user.userId);

            const updated = await this.powerDateRepo.save(powerDate);

            return response(
                res,
                StatusCodes.OK,
                "Updated successfully",
                updated
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
        @Res() res: Response,
        @Req() req: RequestWithUser
    ) {
        const page = Math.max(Number(query.page) || 0, 0);
        const limit = Math.max(Number(query.limit) || 10, 1);
        const search = query.search?.toString();
        const memberId = new ObjectId(req.user.userId);
        const match: any = {
            $or: [
                { createdBy: memberId },
                { members: { $in: [memberId] } }
            ],
            isDelete: 0
        };

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
                                _id: 1,
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
