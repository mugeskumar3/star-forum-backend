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
import { Member } from "../../entity/Member";
import { ObjectId } from "mongodb";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/common-apis")
export class CommonController {
    private chapterRepo = AppDataSource.getMongoRepository(Chapter);
    private memberRepository = AppDataSource.getMongoRepository(Member);
    // =========================
    // ✅ Chapters List (AGGREGATION + MEMBER LOOKUP)
    // =========================
    @Get("/chapter-list")
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

    @Get("/member-list")
    async listMembers(
        @Req() req: RequestWithUser,
        @Res() res: Response,
        @QueryParams() params: any,

    ) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Number(req.query.limit) || 0;

            const loginMember = await this.memberRepository.findOneBy({
                _id: new ObjectId(req.user.userId),
                isDelete: 0
            });

            if (!loginMember) {
                return res.status(404).json({ message: "Member not found" });
            }

            const match: any = {
                isDelete: 0,
            };

            if (params.chapterId) {
                match.chapter = new ObjectId(params.chapterId)
            }
            else {
                match.chapter = loginMember.chapter
            }

            if (params.phoneNumber) {
                match.$or = [
                    { phoneNumber: { $regex: params.phoneNumber, $options: "i" } }
                ];
            }
            const pipeline: any[] = [
                { $match: match },
                { $sort: { createdAt: -1 } },
                {
                    $project: {
                        _id: 1,
                        fullName: 1,
                        profileImage: 1,
                        membershipId: 1,
                    }
                }
            ];

            if (limit > 0) {
                pipeline.push(
                    { $skip: page * limit },
                    { $limit: limit }
                );
            }

            const data = await this.memberRepository.aggregate(pipeline).toArray();

            const total = await this.memberRepository.countDocuments(match);

            return pagination(
                total,
                data,
                limit > 0 ? limit : total,
                page,
                res
            );

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
}
