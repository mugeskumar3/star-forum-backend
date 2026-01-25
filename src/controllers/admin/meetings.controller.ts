import {
    Post,
    Body,
    Req,
    Res,
    UseBefore,
    JsonController,
    Put,
    Param,
    Get,
    Delete
} from "routing-controllers";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { AppDataSource } from "../../data-source";
import { Meeting } from "../../entity/Meeting";
import { handleErrorResponse, pagination, response } from "../../utils";
import { CreateMeetingDto } from "../../dto/admin/Meeting.dto";

interface RequestWithUser extends Request {
    query: any;
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/meetings")
export class MeetingController {

    private meetingRepository =
        AppDataSource.getMongoRepository(Meeting);

    // --------------------------------------------------
    // CREATE MEETING
    // --------------------------------------------------
    @Post("/create")
    async createMeeting(
        @Req() req: RequestWithUser,
        @Body() body: CreateMeetingDto,
        @Res() res: Response
    ) {
        try {

            const meeting = new Meeting();

            // --------------------
            // BASIC INFO
            // --------------------
            meeting.meetingTopic = body.meetingTopic;
            meeting.meetingFee = body.meetingFee;
            meeting.visitorFee = body.visitorFee;
            meeting.hotelName = body.hotelName;

            // --------------------
            // CHAPTERS
            // --------------------
            meeting.chapters = body.chapters.map(
                (id) => new ObjectId(id)
            );

            // --------------------
            // DATE & TIME
            // --------------------
            meeting.startDateTime = new Date(body.startDateTime);
            meeting.endDateTime = new Date(body.endDateTime);
            meeting.latePunchTime = new Date(body.latePunchTime);

            // --------------------
            // LOCATION (OBJECT)
            // --------------------
            meeting.location = {
                name: body.location.name,
                latitude: body.location.latitude,
                longitude: body.location.longitude
            };

            // --------------------
            // SYSTEM FIELDS
            // --------------------
            meeting.isActive = 1;
            meeting.isDelete = 0;
            meeting.createdBy = new ObjectId(req.user.userId);
            meeting.createdAt = new Date();

            await this.meetingRepository.save(meeting);

            return response(
                res,
                StatusCodes.CREATED,
                "Meeting created successfully",
                meeting
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }


    // --------------------------------------------------
    // EDIT MEETING
    // --------------------------------------------------
    @Put("/edit/:id")
    async editMeeting(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Body() body: CreateMeetingDto,
        @Res() res: Response
    ) {
        try {

            if (!ObjectId.isValid(id)) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid meeting id"
                );
            }

            const meeting = await this.meetingRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!meeting) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Meeting not found"
                );
            }

            // --------------------
            // UPDATE FIELDS (IF SENT)
            // --------------------
            if (body.meetingTopic)
                meeting.meetingTopic = body.meetingTopic;

            if (body.meetingFee !== undefined)
                meeting.meetingFee = body.meetingFee;

            if (body.visitorFee !== undefined)
                meeting.visitorFee = body.visitorFee;

            if (body.hotelName)
                meeting.hotelName = body.hotelName;

            if (body.chapters?.length) {
                meeting.chapters = body.chapters.map(
                    (id) => new ObjectId(id)
                );
            }

            if (body.startDateTime)
                meeting.startDateTime = new Date(body.startDateTime);

            if (body.endDateTime)
                meeting.endDateTime = new Date(body.endDateTime);

            if (body.latePunchTime)
                meeting.latePunchTime = new Date(body.latePunchTime);

            if (body.location) {
                meeting.location = {
                    name: body.location.name,
                    latitude: body.location.latitude,
                    longitude: body.location.longitude
                };
            }

            // --------------------
            // SYSTEM FIELDS
            // --------------------
            meeting.updatedBy = new ObjectId(req.user.userId);
            meeting.updatedAt = new Date();

            await this.meetingRepository.save(meeting);

            return response(
                res,
                StatusCodes.OK,
                "Meeting updated successfully",
                meeting
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }
    // --------------------------------------------------
    // LIST MEETINGS
    // --------------------------------------------------
    @Get("/list")
    async listMeetings(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);

            const search = req.query.search?.toString();
            const chapter = req.query.chapter?.toString();
            const isActive = req.query.isActive?.toString();

            // --------------------------------------------------
            // MATCH STAGE
            // --------------------------------------------------
            const match: any = { isDelete: 0 };

            // SEARCH (topic / hotel / location name)
            if (search) {
                match.$or = [
                    { meetingTopic: { $regex: search, $options: "i" } },
                    { hotelName: { $regex: search, $options: "i" } },
                    { "location.name": { $regex: search, $options: "i" } }
                ];
            }

            // FILTER BY CHAPTER (array field)
            if (chapter) {
                match.chapters = { $in: [new ObjectId(chapter)] };
            }

            // FILTER BY STATUS
            if (isActive !== undefined) {
                match.isActive = Number(isActive);
            }

            // --------------------------------------------------
            // AGGREGATION PIPELINE
            // --------------------------------------------------
            const pipeline = [
                { $match: match },

                {
                    $lookup: {
                        from: "chapters",
                        localField: "chapters",
                        foreignField: "_id",
                        as: "chapters"
                    }
                },
                // { $unwind: { path: "$chapters", preserveNullAndEmptyArrays: true } },

                { $sort: { createdAt: -1 } },

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
            ];

            const result = await this.meetingRepository
                .aggregate(pipeline)
                .toArray();

            const data = result[0]?.data || [];
            const total = result[0]?.meta[0]?.total || 0;

            return pagination(total, data, limit, page, res);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    // --------------------------------------------------
    // MEETING DETAILS
    // --------------------------------------------------
    @Get("/details/:id")
    async meetingDetails(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid meeting id"
                );
            }

            const pipeline = [
                {
                    $match: {
                        _id: new ObjectId(id),
                        isDelete: 0
                    }
                },
                {
                    $lookup: {
                        from: "chapters",
                        localField: "chapters",
                        foreignField: "_id",
                        as: "chapters"
                    }
                },

            ];

            const result = await this.meetingRepository
                .aggregate(pipeline)
                .toArray();

            if (!result.length) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Meeting not found"
                );
            }

            return response(
                res,
                StatusCodes.OK,
                "Meeting details fetched successfully",
                result[0]
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }
    // --------------------------------------------------
    // DELETE MEETING (SOFT DELETE)
    // --------------------------------------------------
    @Delete("/delete/:id")
    async deleteMeeting(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid meeting id"
                );
            }

            const meeting = await this.meetingRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!meeting) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Meeting not found"
                );
            }

            meeting.isDelete = 1;
            meeting.updatedAt = new Date();
            meeting.updatedBy = new ObjectId(req.user.userId);

            await this.meetingRepository.save(meeting);

            return response(
                res,
                StatusCodes.OK,
                "Meeting deleted successfully"
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }

}
