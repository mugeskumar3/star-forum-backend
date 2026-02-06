import {
    JsonController,
    Post,
    Body,
    Req,
    Res,
    UseBefore,
    Get,
    QueryParams
} from "routing-controllers";
import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { pagination } from "../../utils";
import { Notifications } from "../../entity/Notification";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/notification")
export class NotificationController {
    private notificationRepo = AppDataSource.getMongoRepository(Notifications);

    @Get('/list')
    async listNotification(
        @QueryParams() query: any,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        const page = Math.max(Number(query.page) || 0, 0);
        const limit = Math.max(Number(query.limit) || 10, 1);
        const userId = new ObjectId(req.user.userId);

        const match: any = { isDelete: 0 };

        // 🔍 SEARCH
        if (query.search) {
            const s = query.search.toString();
            match.$or = [
                { subject: { $regex: s, $options: "i" } },
                { content: { $regex: s, $options: "i" } }
            ];
        }

        // 📌 MODULE TYPE FILTER
        if (query.moduleType) {
            const type = query.moduleType.toString();

            if (type === "general") {
                match.moduleName = { $in: ["121", "THANKYOU", "CHIEF_GUEST", "CONNECTION_REQ"] };
            } else {
                match.moduleName = type;
            }
        }

        const pipeline: any = [
            { $match: match },

            // -----------------------------------------------------------
            // 🔹 CHIEF GUEST LOOKUP
            // -----------------------------------------------------------
            {
                $lookup: {
                    from: "chiefguests",
                    localField: "moduleId",
                    foreignField: "_id",
                    as: "chiefGuestData"
                }
            },
            { $unwind: { path: "$chiefGuestData", preserveNullAndEmptyArrays: true } },

            // -----------------------------------------------------------
            // 🔹 THANK YOU LOOKUP
            // -----------------------------------------------------------
            {
                $lookup: {
                    from: "thankyou",
                    localField: "moduleId",
                    foreignField: "_id",
                    as: "thankYouData"
                }
            },
            { $unwind: { path: "$thankYouData", preserveNullAndEmptyArrays: true } },

            // -----------------------------------------------------------
            // 🔹 121 MEETING LOOKUP
            // -----------------------------------------------------------
            {
                $lookup: {
                    from: "one_to_one_meetings",
                    localField: "moduleId",
                    foreignField: "_id",
                    as: "oneTwoOneData"
                }
            },
            { $unwind: { path: "$oneTwoOneData", preserveNullAndEmptyArrays: true } },

            // -----------------------------------------------------------
            // 🔹 CONNECTION REQUEST LOOKUP (with login user filter)
            // -----------------------------------------------------------
            {
                $lookup: {
                    from: "connection_request",
                    let: { moduleId: "$moduleId", loggedInUser: userId },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$_id", "$$moduleId"] },
                                        {
                                            $or: [
                                                { $eq: ["$createdBy", "$$loggedInUser"] },
                                                { $eq: ["$memberId", "$$loggedInUser"] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "connectionReqs"
                }
            },
            {
                $unwind: {
                    path: "$connectionReqs",
                    preserveNullAndEmptyArrays: true
                }
            },

            // -----------------------------------------------------------
            // 🔹 MERGE MODULE DETAILS
            // -----------------------------------------------------------
            {
                $addFields: {
                    moduleDetails: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$moduleName", "CHIEF_GUEST"] }, then: "$chiefGuestData" },
                                { case: { $eq: ["$moduleName", "THANKYOU"] }, then: "$thankYouData" },
                                { case: { $eq: ["$moduleName", "121"] }, then: "$oneTwoOneData" },
                                { case: { $eq: ["$moduleName", "CONNECTION_REQ"] }, then: "$connectionReqs" }
                            ],
                            default: null
                        }
                    }
                }
            },

            // -----------------------------------------------------------
            // 🔹 CLEANUP
            // -----------------------------------------------------------
            {
                $project: {
                    chiefGuestData: 0,
                    thankYouData: 0,
                    oneTwoOneData: 0,
                    connectionReqs: 0
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

        const [result] = await this.notificationRepo.aggregate(pipeline).toArray();

        const data = result?.data || [];
        const total = result?.meta?.[0]?.total || 0;

        return pagination(total, data, limit, page, res);
    }


}