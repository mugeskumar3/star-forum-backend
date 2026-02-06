import {
    JsonController,
    UseBefore,
    Get,
    Req,
    Res,
    QueryParams
} from "routing-controllers";
import { Request } from "express";
import { ObjectId } from "mongodb";
import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { Member } from "../../entity/Member";
import { Meeting } from "../../entity/Meeting";
import response from "../../utils/response";
import { handleErrorResponse } from "../../utils";
import { StatusCodes } from "http-status-codes";
import { Referral } from "../../entity/Referral";
import { ThankYouSlip } from "../../entity/ThankyouSlip";
import { OneToOneMeeting } from "../../entity/121's";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/dashboard-apis")
export class DashBoardController {
    private memberRepo = AppDataSource.getMongoRepository(Member);
    private meetingRepo = AppDataSource.getMongoRepository(Meeting);
    private refRepo = AppDataSource.getMongoRepository(Referral);
    private thankYouRepo = AppDataSource.getMongoRepository(ThankYouSlip);
    private onetooneRepo = AppDataSource.getMongoRepository(OneToOneMeeting);
    @Get("/chapter-members-contribution-counts")
    async getChapterMembersCounts(@Req() req: RequestWithUser) {
        try {
            const userId = new ObjectId(req.user.userId);

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

            const chapterId: ObjectId = currentMember.chapter;

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
                        // ✔ Count members
                        totalMembers: [{ $count: "count" }],

                        // ✔ Visitors count
                        visitors: [
                            {
                                $lookup: {
                                    from: "visitors",
                                    let: { memberId: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: { $eq: ["$createdBy", "$$memberId"] },
                                                isActive: 1,
                                                isDelete: 0
                                            }
                                        }
                                    ],
                                    as: "d"
                                }
                            },
                            { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                        ],

                        // ⭐ THANK YOU SLIPS → COUNT + TOTAL AMOUNT
                        thankYouSlips: [
                            {
                                $lookup: {
                                    from: "thank_you_slips",
                                    let: { memberId: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: { $eq: ["$createdBy", "$$memberId"] },
                                                isActive: 1,
                                                isDelete: 0
                                            }
                                        },
                                        { $project: { amount: 1 } } // Extract amount field
                                    ],
                                    as: "d"
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    count: { $sum: { $size: "$d" } },
                                    totalAmount: { $sum: { $sum: "$d.amount" } }
                                }
                            }
                        ],

                        // ✔ Referrals count
                        referrals: [
                            {
                                $lookup: {
                                    from: "referrals",
                                    let: { memberId: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: { $eq: ["$toMemberId", "$$memberId"] },
                                                isDelete: 0
                                            }
                                        }
                                    ],
                                    as: "d"
                                }
                            },
                            { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                        ],

                        // ✔ One to one meetings
                        oneToOneMeetings: [
                            {
                                $lookup: {
                                    from: "one_to_one_meetings",
                                    let: { memberId: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: { $eq: ["$createdBy", "$$memberId"] },
                                                isActive: 1,
                                                isDelete: 0
                                            }
                                        }
                                    ],
                                    as: "d"
                                }
                            },
                            { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                        ],

                        // ✔ Mobile Chief Guest
                        mobileChiefGuest: [
                            {
                                $lookup: {
                                    from: "mobile_chief_guest",
                                    let: { memberId: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: { $eq: ["$createdBy", "$$memberId"] },
                                                isActive: 1,
                                                isDelete: 0
                                            }
                                        }
                                    ],
                                    as: "d"
                                }
                            },
                            { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                        ],

                        // ✔ Power Date
                        powerDate: [
                            {
                                $lookup: {
                                    from: "power_date",
                                    let: { memberId: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: { $eq: ["$createdBy", "$$memberId"] },
                                                isActive: 1,
                                                isDelete: 0
                                            }
                                        }
                                    ],
                                    as: "d"
                                }
                            },
                            { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                        ]
                    }
                }
            ]).toArray();

            const r = aggResult[0] || {};

            const counts = {
                visitors: r.visitors?.[0]?.count || 0,

                thankYouSlips: r.thankYouSlips?.[0]?.count || 0,
                thankYouTotalAmount: r.thankYouSlips?.[0]?.totalAmount || 0,

                referrals: r.referrals?.[0]?.count || 0,
                oneToOneMeetings: r.oneToOneMeetings?.[0]?.count || 0,
                mobileChiefGuest: r.mobileChiefGuest?.[0]?.count || 0,
                powerDate: r.powerDate?.[0]?.count || 0
            };

            return {
                success: true,
                data: {
                    chapterId: chapterId.toString(),
                    totalMembers: r.totalMembers?.[0]?.count || 0,
                    counts: {
                        ...counts,
                        total: Object.values(counts).reduce((a, b) => a + b, 0)
                    }
                }
            };

        } catch (error) {
            console.error("Dashboard aggregation error:", error);
            return {
                success: false,
                message: "Failed to fetch chapter contribution counts"
            };
        }
    }


    @Get("/login-member-contribution-counts")
    async getLoginMemberContributionCounts(
        @Req() req: RequestWithUser,
        @QueryParams() query: any
    ) {
        try {
            const memberId = new ObjectId(req.user.userId);

            /* -----------------------------------------
             * DATE FILTER LOGIC
             * ----------------------------------------- */
            const period = query.filter || "overall";

            const now = new Date();
            const currentYear = now.getFullYear();
            let startDate: Date | null = null;
            let endDate: Date = new Date();

            if (period && period !== "overall") {
                if (period === "current_month" || period === "1_month") {
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                } else if (period === "tenure_1") {
                    startDate = new Date(currentYear, 0, 1);
                    endDate = new Date(currentYear, 5, 30, 23, 59, 59, 999);
                } else if (period === "tenure_2") {
                    startDate = new Date(currentYear, 6, 1);
                    endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
                } else if (period === "one_year" || period === "1_year") {
                    startDate = new Date(currentYear, 0, 1);
                    endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
                } else if (period === "week") {
                    const today = new Date();
                    const day = today.getDay();
                    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                    startDate = new Date(today.getFullYear(), today.getMonth(), diff);
                } else if (period === "3_month") {
                    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                }
            }

            const dateMatch = startDate
                ? { createdAt: { $gte: startDate, $lte: endDate } }
                : {};

            /* -----------------------------------------
             * AGGREGATION
             * ----------------------------------------- */
            const aggResult = await this.memberRepo
                .aggregate([
                    {
                        $match: {
                            _id: memberId,
                            isActive: 1,
                            isDelete: 0
                        }
                    },
                    {
                        $facet: {
                            /* -------- VISITORS -------- */
                            visitors: [
                                {
                                    $lookup: {
                                        from: "visitors",
                                        let: { memberId: "$_id" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$createdBy", "$$memberId"] },
                                                            { $eq: ["$isActive", 1] },
                                                            { $eq: ["$isDelete", 0] }
                                                        ]
                                                    },
                                                    ...dateMatch
                                                }
                                            }
                                        ],
                                        as: "d"
                                    }
                                },
                                { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                            ],

                            /* -------- THANK YOU SLIPS -------- */
                            thankYouSlips: [
                                {
                                    $lookup: {
                                        from: "thank_you_slips",
                                        let: { memberId: "$_id" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$isActive", 1] },
                                                            { $eq: ["$isDelete", 0] },
                                                            {
                                                                $or: [
                                                                    { $eq: ["$createdBy", "$$memberId"] },
                                                                    { $eq: ["$thankTo", "$$memberId"] }
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    ...dateMatch
                                                }
                                            },
                                            {
                                                $project: {
                                                    amount: 1,
                                                    isSent: { $eq: ["$createdBy", "$$memberId"] },
                                                    isReceived: { $eq: ["$thankTo", "$$memberId"] }
                                                }
                                            }
                                        ],
                                        as: "slips"
                                    }
                                },
                                {
                                    $group: {
                                        _id: null,
                                        sentCount: {
                                            $sum: {
                                                $size: {
                                                    $filter: {
                                                        input: "$slips",
                                                        as: "s",
                                                        cond: { $eq: ["$$s.isSent", true] }
                                                    }
                                                }
                                            }
                                        },
                                        receivedCount: {
                                            $sum: {
                                                $size: {
                                                    $filter: {
                                                        input: "$slips",
                                                        as: "s",
                                                        cond: { $eq: ["$$s.isReceived", true] }
                                                    }
                                                }
                                            }
                                        },
                                        sentAmount: {
                                            $sum: {
                                                $sum: {
                                                    $map: {
                                                        input: {
                                                            $filter: {
                                                                input: "$slips",
                                                                as: "s",
                                                                cond: { $eq: ["$$s.isSent", true] }
                                                            }
                                                        },
                                                        as: "x",
                                                        in: "$$x.amount"
                                                    }
                                                }
                                            }
                                        },
                                        receivedAmount: {
                                            $sum: {
                                                $sum: {
                                                    $map: {
                                                        input: {
                                                            $filter: {
                                                                input: "$slips",
                                                                as: "s",
                                                                cond: { $eq: ["$$s.isReceived", true] }
                                                            }
                                                        },
                                                        as: "x",
                                                        in: "$$x.amount"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            ],

                            /* -------- REFERRALS -------- */
                            referrals: [
                                {
                                    $lookup: {
                                        from: "referrals",
                                        let: { memberId: "$_id" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$fromMemberId", "$$memberId"] },
                                                            { $eq: ["$isDelete", 0] }
                                                        ]
                                                    },
                                                    ...dateMatch
                                                }
                                            }
                                        ],
                                        as: "d"
                                    }
                                },
                                { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                            ],

                            /* -------- ONE TO ONE -------- */
                            oneToOneMeetings: [
                                {
                                    $lookup: {
                                        from: "one_to_one_meetings",
                                        let: { memberId: "$_id" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$createdBy", "$$memberId"] },
                                                            { $eq: ["$isActive", 1] },
                                                            { $eq: ["$isDelete", 0] }
                                                        ]
                                                    },
                                                    ...dateMatch
                                                }
                                            }
                                        ],
                                        as: "d"
                                    }
                                },
                                { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                            ],

                            /* -------- CHIEF GUEST -------- */
                            mobileChiefGuest: [
                                {
                                    $lookup: {
                                        from: "mobile_chief_guest",
                                        let: { memberId: "$_id" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$createdBy", "$$memberId"] },
                                                            { $eq: ["$isActive", 1] },
                                                            { $eq: ["$isDelete", 0] }
                                                        ]
                                                    },
                                                    ...dateMatch
                                                }
                                            }
                                        ],
                                        as: "d"
                                    }
                                },
                                { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                            ],

                            /* -------- POWER DATE -------- */
                            powerDate: [
                                {
                                    $lookup: {
                                        from: "power_date",
                                        let: { memberId: "$_id" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$createdBy", "$$memberId"] },
                                                            { $eq: ["$isActive", 1] },
                                                            { $eq: ["$isDelete", 0] }
                                                        ]
                                                    },
                                                    ...dateMatch
                                                }
                                            }
                                        ],
                                        as: "d"
                                    }
                                },
                                { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                            ],

                            training: [
                                {
                                    $lookup: {
                                        from: "attendance",
                                        let: { memberId: "$_id" },
                                        pipeline: [
                                            {
                                                $match: {
                                                    $expr: {
                                                        $and: [
                                                            { $eq: ["$memberId", "$$memberId"] },
                                                            { $eq: ["$sourceType", "TRAINING"] },
                                                            { $eq: ["$status", "present"] },
                                                            { $eq: ["$isActive", 1] },
                                                            { $eq: ["$isDelete", 0] }
                                                        ]
                                                    },
                                                    ...dateMatch
                                                }
                                            },
                                            {
                                                $lookup: {
                                                    from: "training_participants",
                                                    let: {
                                                        trainingId: "$sourceId",
                                                        memberId: "$memberId"
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
                                                                        { $eq: ["$isActive", 1] },
                                                                        { $eq: ["$isDelete", 0] }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    ],
                                                    as: "participant"
                                                }
                                            },
                                            {
                                                $match: {
                                                    $expr: { $gt: [{ $size: "$participant" }, 0] }
                                                }
                                            }
                                        ],
                                        as: "d"
                                    }
                                },
                                { $group: { _id: null, count: { $sum: { $size: "$d" } } } }
                            ]

                        }
                    }
                ])
                .toArray();

            const r = aggResult[0] || {};
            const TY = r.thankYouSlips?.[0] || {};

            return {
                success: true,
                data: {
                    memberId: memberId.toString(),
                    counts: {
                        visitors: r.visitors?.[0]?.count || 0,
                        thankYouSlipsSent: TY.sentCount || 0,
                        thankYouSlipsSentAmount: TY.sentAmount || 0,
                        thankYouSlipsReceived: TY.receivedCount || 0,
                        thankYouSlipsReceivedAmount: TY.receivedAmount || 0,
                        referrals: r.referrals?.[0]?.count || 0,
                        oneToOneMeetings: r.oneToOneMeetings?.[0]?.count || 0,
                        mobileChiefGuest: r.mobileChiefGuest?.[0]?.count || 0,
                        powerDate: r.powerDate?.[0]?.count || 0,
                        training: r.training?.[0]?.count || 0
                    }
                }
            };

        } catch (error) {
            console.error("Login contribution aggregation error:", error);
            return {
                success: false,
                message: "Failed to fetch login member contribution counts"
            };
        }
    }


    @Get("/upcoming/meeting")
    async upcomingMeetingForMyChapter(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {

            const currentUserId = new ObjectId(req.user.userId);

            const currentMember = await this.memberRepo.findOne({
                where: {
                    _id: currentUserId,
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

            const chapterId = new ObjectId(
                currentMember.chapter
            );

            const pipeline = [
                {
                    $match: {
                        isDelete: 0,
                        isActive: 1,
                        chapters: { $in: [chapterId] },
                        startDateTime: { $gte: new Date() }
                    }
                },
                {
                    $sort: { startDateTime: 1 }
                },
                {
                    $limit: 1
                },
                {
                    $lookup: {
                        from: "chapters",
                        localField: "chapters",
                        foreignField: "_id",
                        as: "chapters"
                    }
                },
                // Lookup assignments
                {
                    $lookup: {
                        from: "meeting_chief_guest",
                        let: { meetingId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$meetingId", "$$meetingId"] },
                                            { $eq: ["$status", "assigned"] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "assignedGuests"
                    }
                },
                {
                    $lookup: {
                        from: "mobile_chief_guest",
                        let: { guestIds: "$assignedGuests.chiefGuestId" },
                        pipeline: [
                            { $match: { $expr: { $in: ["$_id", "$$guestIds"] } } },
                            { $project: { chiefGuestName: 1 } }
                        ],
                        as: "mobileGuests"
                    }
                },
                {
                    $lookup: {
                        from: "chief_guests",
                        let: { guestIds: "$assignedGuests.chiefGuestId" },
                        pipeline: [
                            { $match: { $expr: { $in: ["$_id", "$$guestIds"] } } },
                            { $project: { chiefGuestName: 1 } }
                        ],
                        as: "adminGuests"
                    }
                },
                {
                    $addFields: {
                        chiefGuestNames: {
                            $concatArrays: [
                                { $map: { input: "$mobileGuests", as: "g", in: "$$g.chiefGuestName" } },
                                { $map: { input: "$adminGuests", as: "g", in: "$$g.chiefGuestName" } }
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        chiefGuestName: { $arrayElemAt: ["$chiefGuestNames", 0] }
                    }
                },
                {
                    $project: {
                        assignedGuests: 0,
                        mobileGuests: 0,
                        adminGuests: 0,
                        chiefGuestNames: 0
                    }
                }
            ];

            const result = await this.meetingRepo
                .aggregate(pipeline)
                .toArray();

            return response(
                res,
                StatusCodes.OK,
                "Upcoming meeting fetched successfully",
                result[0] || null
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    @Get('/module-count')
    async getReferralGivenReceivedCount(
        @Req() req: RequestWithUser,
        @QueryParams() query: any
    ) {
        try {
            const memberId = new ObjectId(req.user.userId);

            /* -----------------------------------------
             * DATE FILTER (CALENDAR BASED)
             * ----------------------------------------- */
            const filter = query.filter || "overall";
            const now = new Date();
            const endDate = new Date();
            let startDate: Date | null = null;

            switch (filter) {
                case "week": {
                    const today = new Date();
                    const day = today.getDay();
                    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                    startDate = new Date(today.getFullYear(), today.getMonth(), diff);
                    break;
                }
                case "1_month":
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;

                case "3_month":
                    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    break;

                case "6_month":
                    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                    break;

                case "1_year":
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;

                default:
                    startDate = null;
            }

            const dateMatch = startDate
                ? {
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
                : {};

            /* -----------------------------------------
             * REFERRALS (GIVEN / RECEIVED)
             * ----------------------------------------- */
            const referralAgg = await this.refRepo.aggregate([
                {
                    $match: {
                        isDelete: 0,
                        ...dateMatch,
                        $or: [
                            { fromMemberId: memberId },
                            { toMemberId: memberId }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        given: {
                            $sum: {
                                $cond: [{ $eq: ["$fromMemberId", memberId] }, 1, 0]
                            }
                        },
                        received: {
                            $sum: {
                                $cond: [{ $eq: ["$toMemberId", memberId] }, 1, 0]
                            }
                        }
                    }
                }
            ]).toArray();

            const referralSlip = referralAgg[0] || { given: 0, received: 0 };

            /* -----------------------------------------
             * THANK YOU SLIPS
             * ----------------------------------------- */
            const thankYouAgg = await this.thankYouRepo.aggregate([
                {
                    $match: {
                        isActive: 1,
                        isDelete: 0,
                        ...dateMatch,
                        $or: [
                            { createdBy: memberId },
                            { thankTo: memberId }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,
                        given: {
                            $sum: {
                                $cond: [{ $eq: ["$createdBy", memberId] }, 1, 0]
                            }
                        },
                        received: {
                            $sum: {
                                $cond: [{ $eq: ["$thankTo", memberId] }, 1, 0]
                            }
                        },
                        givenAmount: {
                            $sum: {
                                $cond: [{ $eq: ["$createdBy", memberId] }, "$amount", 0]
                            }
                        },
                        receivedAmount: {
                            $sum: {
                                $cond: [{ $eq: ["$thankTo", memberId] }, "$amount", 0]
                            }
                        }
                    }
                }
            ]).toArray();

            const thankYouSlip = thankYouAgg[0] || {
                given: 0,
                received: 0,
                givenAmount: 0,
                receivedAmount: 0
            };

            /* -----------------------------------------
             * ONE-TO-ONE MEETINGS
             * ----------------------------------------- */
            const oneToOneAgg = await this.onetooneRepo.aggregate([
                {
                    $match: {
                        isActive: 1,
                        isDelete: 0,
                        ...dateMatch,
                        $or: [
                            { initiatedById: memberId },
                            { meetingWithMemberId: memberId },
                            { createdBy: memberId }
                        ]
                    }
                },
                {
                    $group: {
                        _id: null,

                        // SAME AS initiatedBy === SELF
                        initiatedByMe: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$initiatedById", memberId] },
                                    1,
                                    0
                                ]
                            }
                        },

                        // SAME AS initiatedBy === PARTNER
                        initiatedByOthers: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ["$initiatedById", memberId] },
                                            {
                                                $or: [
                                                    { $eq: ["$meetingWithMemberId", memberId] },
                                                    { $eq: ["$createdBy", memberId] }
                                                ]
                                            }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]).toArray();

            const oneToOne = oneToOneAgg[0] || {
                initiatedByMe: 0,
                initiatedByOthers: 0
            };


            /* -----------------------------------------
             * FINAL RESPONSE
             * ----------------------------------------- */
            return {
                success: true,
                data: {
                    thankYouSlip,
                    referralSlip,
                    oneToOne
                }
            };

        } catch (error) {
            console.error("Insights aggregation error:", error);
            return {
                success: false,
                message: "Failed to fetch insights data"
            };
        }
    }


}
