import {
    Post,
    Body,
    Req,
    Res,
    UseBefore,
    JsonController,
    Put,
    Param
} from "routing-controllers";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { AppDataSource } from "../../data-source";
import { Meeting } from "../../entity/Meeting";
import { response } from "../../utils";
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
}
