import {
    JsonController,
    Get,
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
import { Training } from "../../entity/Training";
import { Member } from "../../entity/Member";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/training")
export class MobileTrainingController {
    private trainingRepository = AppDataSource.getMongoRepository(Training);
    private memberRepository = AppDataSource.getMongoRepository(Member);

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
                // ✅ REMOVE unwanted ID arrays
                {
                    $project: {
                        chapterIds: 0,
                        trainerIds: 0
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
}
