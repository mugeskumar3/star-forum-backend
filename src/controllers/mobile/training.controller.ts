import {
    JsonController,
    Get,
    Req,
    Res,
    QueryParams,
    UseBefore,
    Post,
    Body
} from "routing-controllers";
import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { Training } from "../../entity/Training";
import { Member } from "../../entity/Member";
import { TrainingParticipants } from "../../entity/TrainingParticipants";
import { CreateTrainingMember } from "../../dto/mobile/TrainingParticipants";
import { Attendance } from "../../entity/Attendance";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/training")
export class MobileTrainingController {
    private trainingRepository = AppDataSource.getMongoRepository(Training);
    private memberRepository = AppDataSource.getMongoRepository(Member);
    private particantRepository = AppDataSource.getMongoRepository(TrainingParticipants);
    private attendanceRepo = AppDataSource.getMongoRepository(Attendance);

    // =========================
    // ✅ LIST TRAININGS (Filtered by Member's Chapter)
    // =========================
    @Get("/list")
    async listTrainings(
        @QueryParams() query: any,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(query.page) || 0, 0);
            const limit = Math.max(Number(query.limit) || 10, 1);
            const search = query.search?.toString();

            // 1. Get Logged-in Member's Details
            const userId = new ObjectId(req.user.userId);
            const member = await this.memberRepository.findOneBy({ _id: userId });

            if (!member) {
                return response(res, StatusCodes.NOT_FOUND, "Member not found");
            }

            const memberChapterId = member.chapter;

            // 2. Build Match Query
            const match: any = {
                isDelete: 0,
                isActive: 1, // Only active trainings
                chapterIds: { $in: [memberChapterId] } // Check if member's chapter is in training's chapterIds
            };

            if (search) {
                match.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { description: { $regex: search, $options: "i" } }
                ];
            }

            const pipeline = [
                { $match: match },
                { $sort: { trainingDateTime: 1 } },

                // 🔹 Lookup Chapters
                {
                    $lookup: {
                        from: "chapters",
                        let: { chapterIds: "$chapterIds" },
                        pipeline: [
                            { $match: { $expr: { $in: ["$_id", "$$chapterIds"] } } },
                            { $project: { _id: 1, chapterName: 1 } }
                        ],
                        as: "chapters"
                    }
                },

                // 🔹 Lookup Trainers (Admin Users)
                {
                    $lookup: {
                        from: "adminusers",
                        let: { trainerIds: "$trainerIds" },
                        pipeline: [
                            { $match: { $expr: { $in: ["$_id", "$$trainerIds"] } } },
                            { $project: { _id: 1, name: 1 } }
                        ],
                        as: "trainers"
                    }
                },
                {
                    $lookup: {
                        from: "training_participants",
                        let: {
                            trainingId: "$_id",
                            memberId: userId
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$trainingId", "$$trainingId"] },
                                            { $eq: ["$memberId", "$$memberId"] },
                                            { $eq: ["$isDelete", 0] }
                                        ]
                                    }
                                }
                            },
                            {
                                $project: {
                                    _id: 1,
                                    status: 1,
                                    paymentStatus: 1
                                }
                            }
                        ],
                        as: "training_participants"
                    }
                },
                {
                    $addFields: {
                        canApply: {
                            $cond: {
                                if: { $gt: [{ $size: "$training_participants" }, 0] },
                                then: false,
                                else: true
                            }
                        },
                        participantInfo: {
                            $cond: {
                                if: { $gt: [{ $size: "$training_participants" }, 0] },
                                then: { $arrayElemAt: ["$training_participants", 0] },
                                else: {
                                    _id: "",
                                    status: "",
                                    paymentStatus: ""
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        chapterIds: 0,
                        trainerIds: 0,
                        training_participants: 0

                    }
                },
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

            const [result] = await this.trainingRepository
                .aggregate(pipeline)
                .toArray();

            const data = result?.data || [];
            const total = result?.meta?.[0]?.total || 0;

            return pagination(total, data, limit, page, res);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    @Post("/status")
    async createPowerDate(
        @Body() body: CreateTrainingMember,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const powerDate = new TrainingParticipants();

            powerDate.memberId = new ObjectId(req.user.userId);
            powerDate.trainingId = new ObjectId(body.trainingId);
            powerDate.status = body.status;
            powerDate.paymentStatus = 'pending';

            powerDate.isActive = 1;
            powerDate.isDelete = 0;
            powerDate.createdBy = new ObjectId(req.user.userId);
            powerDate.updatedBy = new ObjectId(req.user.userId);

            const saved = await this.particantRepository.save(powerDate);

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
    @Get("/attended")
    async listMyAttendedTrainings(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {

            const memberId = new ObjectId(req.user.userId);

            const page = Math.max(Number(req.query.page) || 0, 0);
            let limit = Number(req.query.limit || 0);

            const basePipeline: any[] = [

                {
                    $match: {
                        memberId,
                        sourceType: "TRAINING",
                        status: "present",
                        isDelete: 0
                    }
                },

                {
                    $lookup: {
                        from: "training",
                        localField: "sourceId",
                        foreignField: "_id",
                        as: "training"
                    }
                },
                { $unwind: "$training" },

                {
                    $lookup: {
                        from: "training_participants",
                        let: {
                            trainingId: "$training._id",
                            memberId
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$trainingId", "$$trainingId"] },
                                            { $eq: ["$memberId", "$$memberId"] },
                                            { $eq: ["$status", "Approved"] },
                                            { $eq: ["$paymentStatus", "Paid"] },
                                            { $eq: ["$isDelete", 0] }
                                        ]
                                    }
                                }
                            },
                            { $project: { status: 1, paymentStatus: 1 } }
                        ],
                        as: "participant"
                    }
                },

                { $match: { participant: { $ne: [] } } },
                { $unwind: "$participant" },

                {
                    $project: {
                        _id: "$training._id",
                        trainingId: "$training.trainingId",
                        title: "$training.title",
                        description: "$training.description",
                        trainingDateTime: "$training.trainingDateTime",
                        lastDateForApply: "$training.lastDateForApply",
                        duration: "$training.duration",
                        mode: "$training.mode",
                        locationOrLink: "$training.locationOrLink",
                        maxAllowed:  "$training.maxAllowed",
                        status: "$training.status",
                        trainingFee: "$training.trainingFee",
                        attendanceStatus: "present",
                        participantStatus: "$participant.status",
                        paymentStatus: "$participant.paymentStatus"
                    }
                },

                { $sort: { trainingDateTime: -1 } }
            ];

            if (limit > 0) {
                basePipeline.push(
                    {
                        $facet: {
                            data: [
                                { $skip: page * limit },
                                { $limit: limit }
                            ],
                            meta: [
                                { $count: "total" }
                            ]
                        }
                    }
                );

                const [result] = await this.attendanceRepo
                    .aggregate(basePipeline)
                    .toArray();

                const data = result?.data || [];
                const total = result?.meta?.[0]?.total || 0;

                return pagination(total, data, limit, page, res);
            }

            const data = await this.attendanceRepo
                .aggregate(basePipeline)
                .toArray();

            return response(
                res,
                StatusCodes.OK,
                "Attended trainings fetched successfully",
                data
            );

        } catch (error) {
            console.error(error);
            return handleErrorResponse(error, res);
        }
    }

}
