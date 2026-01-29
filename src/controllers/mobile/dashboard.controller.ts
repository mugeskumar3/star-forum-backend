import {
    JsonController,
    UseBefore,
    Get,
    Req
} from "routing-controllers";
import { Request } from "express";
import { ObjectId } from "mongodb";
import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { Member } from "../../entity/Member";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/dashboard-apis")
export class DashBoardController {
    private memberRepo = AppDataSource.getMongoRepository(Member);

    @Get("/chapter-members-contribution-counts")
    async getChapterMembersCounts(@Req() req: RequestWithUser) {
        try {
            const userId = new ObjectId(req.user.userId);

            /* -------------------------------------------------
               STEP 1: Get chapter of logged-in member
            ------------------------------------------------- */
            const currentMember = await this.memberRepo.findOne({
                where: {
                    _id: userId,
                    isActive: 1,
                    isDelete: 0
                } as any,
                select: ["chapter"]
            });

            if (!currentMember?.chapter) {
                return {
                    success: false,
                    message: "Member or chapter not found"
                };
            }

            const chapterId = currentMember.chapter;

            /* -------------------------------------------------
               STEP 2: SINGLE AGGREGATION (FAST)
            ------------------------------------------------- */
            const aggResult = await this.memberRepo.aggregate([
                {
                    $match: {
                        chapter: chapterId,
                        isActive: 1,
                        isDelete: 0
                    }
                },
                {
                    $facet: {
                        totalMembers: [{ $count: "count" }],

                        visitors: [
                            {
                                $lookup: {
                                    from: "visitors",
                                    localField: "_id",
                                    foreignField: "createdBy",
                                    pipeline: [{ $match: { isActive: 1, isDelete: 0 } }],
                                    as: "d"
                                }
                            },
                            { $unwind: "$d" },
                            { $count: "count" }
                        ],

                        thankYouSlips: [
                            {
                                $lookup: {
                                    from: "thank_you_slips",
                                    localField: "_id",
                                    foreignField: "createdBy",
                                    pipeline: [{ $match: { isActive: 1, isDelete: 0 } }],
                                    as: "d"
                                }
                            },
                            { $unwind: "$d" },
                            { $count: "count" }
                        ],

                        referrals: [
                            {
                                $lookup: {
                                    from: "referrals",
                                    localField: "_id",
                                    foreignField: "fromMemberId",
                                    pipeline: [{ $match: { isActive: 1, isDelete: 0 } }],
                                    as: "d"
                                }
                            },
                            { $unwind: "$d" },
                            { $count: "count" }
                        ],

                        oneToOneMeetings: [
                            {
                                $lookup: {
                                    from: "one_to_one_meetings",
                                    localField: "_id",
                                    foreignField: "createdBy",
                                    pipeline: [{ $match: { isActive: 1, isDelete: 0 } }],
                                    as: "d"
                                }
                            },
                            { $unwind: "$d" },
                            { $count: "count" }
                        ],

                        mobileChiefGuest: [
                            {
                                $lookup: {
                                    from: "mobile_chief_guests",
                                    localField: "_id",
                                    foreignField: "createdBy",
                                    pipeline: [{ $match: { isActive: 1, isDelete: 0 } }],
                                    as: "d"
                                }
                            },
                            { $unwind: "$d" },
                            { $count: "count" }
                        ],

                        powerDate: [
                            {
                                $lookup: {
                                    from: "power_dates",
                                    localField: "_id",
                                    foreignField: "createdBy",
                                    pipeline: [{ $match: { isActive: 1, isDelete: 0 } }],
                                    as: "d"
                                }
                            },
                            { $unwind: "$d" },
                            { $count: "count" }
                        ]
                    }
                }
            ]).toArray();

            const r = aggResult[0] || {};

            const counts = {
                visitors: r.visitors?.[0]?.count || 0,
                thankYouSlips: r.thankYouSlips?.[0]?.count || 0,
                referrals: r.referrals?.[0]?.count || 0,
                oneToOneMeetings: r.oneToOneMeetings?.[0]?.count || 0,
                mobileChiefGuest: r.mobileChiefGuest?.[0]?.count || 0,
                powerDate: r.powerDate?.[0]?.count || 0
            };

            return {
                success: true,
                data: {
                    chapterId,
                    totalMembers: r.totalMembers?.[0]?.count || 0,
                    counts: {
                        ...counts,
                        total: Object.values(counts).reduce((a, b) => a + b, 0)
                    }
                }
            };
        } catch (error: any) {
            console.error("Dashboard aggregation error:", error);
            return {
                success: false,
                message: "Failed to fetch chapter contribution counts"
            };
        }
    }
}
