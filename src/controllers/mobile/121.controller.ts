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
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";

import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import { OneToOneMeeting } from "../../entity/121's";
import { CreateOneToOneMeetingDto } from "../../dto/mobile/121.dto";
import { pagination } from "../../utils";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/one-to-one")
export class OneToOneMeetingController {
    private meetingRepo = AppDataSource.getMongoRepository(OneToOneMeeting);

    // ✅ CREATE 121 MEETING
    @Post("/")
    async createOneToOneMeeting(
        @Body() body: CreateOneToOneMeetingDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            // 🔹 Optional: Prevent duplicate 121 on same day with same member
            const existing = await this.meetingRepo.findOne({
                where: {
                    meetingWithMemberId: new ObjectId(body.meetingWithMemberId),
                    createdBy: new ObjectId(req.user.userId),
                    meetingDateTime: new Date(body.meetingDateTime),
                    isDelete: 0
                }
            });

            if (existing) {
                return response(
                    res,
                    StatusCodes.CONFLICT,
                    "121 meeting already logged with this member for the selected date & time"
                );
            }

            // 🔹 Create meeting
            const meeting = new OneToOneMeeting();

            meeting.chapterType = body.chapterType;
            meeting.meetingWithMemberId = new ObjectId(body.meetingWithMemberId);
            meeting.initiatedBy = body.initiatedBy;

            meeting.meetingDateTime = new Date(body.meetingDateTime);
            meeting.meetingLocation = body.meetingLocation;

            meeting.topicDiscussed = body.topicDiscussed || null;
            meeting.photos = body.photos || [];

            meeting.status = "COMPLETED";
            meeting.isActive = 1;
            meeting.isDelete = 0;

            meeting.createdBy = new ObjectId(req.user.userId);
            meeting.updatedBy = new ObjectId(req.user.userId);

            const savedMeeting = await this.meetingRepo.save(meeting);

            return response(
                res,
                StatusCodes.CREATED,
                "121 meeting logged successfully",
                savedMeeting
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    @Get("/list")
    async listOneToOneMeetings(
        @QueryParams() query: any,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(query.page) || 0, 0);
            const limit = Math.max(Number(query.limit) || 10, 1);

            const match: any = {
                isDelete: 0,
                createdBy: new ObjectId(req.user.userId)
            };

            // 🔹 Filter: chapter type
            if (query.chapterType) {
                match.chapterType = query.chapterType;
            }

            // 🔹 Filter: date range
            if (query.fromDate || query.toDate) {
                match.meetingDateTime = {};
                if (query.fromDate) {
                    match.meetingDateTime.$gte = new Date(query.fromDate);
                }
                if (query.toDate) {
                    match.meetingDateTime.$lte = new Date(query.toDate);
                }
            }

            const pipeline = [
                { $match: match },

                // 🔹 Lookup member (person met)
                {
                    $lookup: {
                        from: "member",
                        localField: "meetingWithMemberId",
                        foreignField: "_id",
                        as: "member"
                    }
                },

                { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },

                {
                    $project: {
                        chapterType: 1,
                        initiatedBy: 1,
                        meetingDateTime: 1,
                        meetingLocation: 1,
                        topicDiscussed: 1,
                        status: 1,
                        photos: 1,
                        createdAt: 1,

                        meetingWith: {
                            _id: "$member._id",
                            name: "$member.fullName",
                            mobile: "$member.phoneNumber",
                            email: "$member.email",
                        }
                    }
                },

                { $sort: { createdAt: -1 } },

                {
                    $facet: {
                        data: [
                            { $skip: page },
                            { $limit: limit }
                        ],
                        meta: [
                            { $count: "total" }
                        ]
                    }
                }
            ];

            const [result] = await this.meetingRepo.aggregate(pipeline).toArray();

            const data = result?.data || [];
            const total = result?.meta?.[0]?.total || 0;

            return pagination(total, data, limit, page, res);
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

}
