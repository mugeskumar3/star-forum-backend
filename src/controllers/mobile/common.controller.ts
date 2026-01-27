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


import { AppDataSource } from "../../data-source";

import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { Chapter } from "../../entity/Chapter";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/common-apis")
export class CommonController {
    private chapterRepo = AppDataSource.getMongoRepository(Chapter);

    // =========================
    // ✅ Chapters List (AGGREGATION + MEMBER LOOKUP)
    // =========================
    @Get("/list")
    async listChapters(
        @QueryParams() query: any,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(query.page) || 0, 0);
            const limit = Math.max(Number(query.limit) || 1000, 1);
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

                {
                    $project: {
                        chapterName: 1,
                        _id: 1
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

            const [result] = await this.chapterRepo.aggregate(pipeline).toArray();

            const data = result?.data || [];
            const total = result?.meta?.[0]?.total || 0;

            return pagination(total, data, limit, page, res);
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
}
