import {
    JsonController,
    Post,
    Body,
    Req,
    Res,
    UseBefore,
    Put,
    Get,
    Param,
    Delete,
} from "routing-controllers";
import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";

import { AppDataSource } from "../../data-source";
import { Meeting } from "../../entity/Meeting";
import { Member } from "../../entity/Member";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { CreateMobileMeetingDto } from "../../dto/mobile/Meeting.dto";
import { CreateMeetingDto } from "../../dto/admin/Meeting.dto";
import { handleErrorResponse, pagination, response } from "../../utils";
import { AssignChiefGuestDto } from "../../dto/mobile/MeetingChiefGuest.dto";
import { MobileChiefGuest } from "../../entity/MobileChiefGuest";
import { ChiefGuest } from "../../entity/ChiefGuest";
import { MeetingChiefGuest } from "../../entity/MeetingChiefGuest";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

const generateMeetingQR = async (meetingId: string) => {
    const uploadDir = path.join(process.cwd(), "public", "meeting", "qr");

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `meeting-${meetingId}.png`;
    const filePath = path.join(uploadDir, fileName);

    const qrData = `meetingId=${meetingId}`;

    await QRCode.toFile(filePath, qrData, {
        width: 300,
        margin: 2,
    });

    return {
        fileName,
        path: `/meeting/qr/${fileName}`,
        originalName: fileName,
    };
};

@UseBefore(AuthMiddleware)
@JsonController("/meeting")
export class MeetingController {
    private meetingRepository = AppDataSource.getMongoRepository(Meeting);

    @Post("/create")
    async createMeeting(
        @Req() req: RequestWithUser,
        @Body() body: CreateMobileMeetingDto,
        @Res() res: Response,
    ) {
        try {
            // Get logged-in user's chapter
            const memberRepo = AppDataSource.getMongoRepository(Member);
            const member = await memberRepo.findOne({
                where: { _id: new ObjectId(req.user.userId) },
                select: ["chapter"],
            });

            if (!member || !member.chapter) {
                return response(
                    res,
                    StatusCodes.FORBIDDEN,
                    "Member not assigned to any chapter",
                );
            }

            const userChapterId = new ObjectId(member.chapter);

            const meeting = this.meetingRepository.create({
                meetingTopic: body.meetingTopic,
                meetingFee: body.meetingFee,
                visitorFee: body.visitorFee,
                hotelName: body.hotelName,

                chapters: [userChapterId],

                startDateTime: new Date(body.startDateTime),
                endDateTime: new Date(body.endDateTime),
                latePunchTime: new Date(body.latePunchTime),

                location: body.location,

                isActive: 1,
                isDelete: 0,

                createdBy: new ObjectId(req.user.userId),
                createdAt: new Date(),
            });

            const savedMeeting = await this.meetingRepository.save(meeting);

            const qrImage = await generateMeetingQR(savedMeeting._id.toString());

            await this.meetingRepository.update(savedMeeting._id, { qrImage });

            savedMeeting.qrImage = qrImage;

            return response(
                res,
                StatusCodes.CREATED,
                "Meeting created successfully",
                savedMeeting,
            );
        } catch (error: any) {
            console.error(error);

            return handleErrorResponse(error, res);
        }
    }

    @Put("/edit/:id")
    async editMeeting(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Body() body: CreateMeetingDto,
        @Res() res: Response,
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid meeting id");
            }

            const meeting = await this.meetingRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0,
            });

            if (!meeting) {
                return response(res, StatusCodes.NOT_FOUND, "Meeting not found");
            }

            if (body.meetingTopic) meeting.meetingTopic = body.meetingTopic;

            if (body.meetingFee !== undefined) meeting.meetingFee = body.meetingFee;

            if (body.visitorFee !== undefined) meeting.visitorFee = body.visitorFee;

            if (body.hotelName) meeting.hotelName = body.hotelName;

            if (body.startDateTime)
                meeting.startDateTime = new Date(body.startDateTime);

            if (body.endDateTime) meeting.endDateTime = new Date(body.endDateTime);

            if (body.latePunchTime)
                meeting.latePunchTime = new Date(body.latePunchTime);

            if (body.location) meeting.location = body.location;

            meeting.updatedBy = new ObjectId(req.user.userId);

            meeting.updatedAt = new Date();

            await this.meetingRepository.save(meeting);

            return response(
                res,
                StatusCodes.OK,
                "Meeting updated successfully",
                meeting,
            );
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/list")
    async listMeetings(@Req() req: RequestWithUser, @Res() res: Response) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);
            const search = req.query.search?.toString();

            // 1. Get logged-in user's chapter
            const memberRepo = AppDataSource.getMongoRepository(Member);
            const member = await memberRepo.findOne({
                where: { _id: new ObjectId(req.user.userId) },
                select: ["chapter"],
            });

            if (!member || !member.chapter) {
                return response(
                    res,
                    StatusCodes.FORBIDDEN,
                    "Member not assigned to any chapter",
                );
            }

            const userChapterId = new ObjectId(member.chapter);
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const match: any = {
                isDelete: 0,
                chapters: { $in: [userChapterId] }, // Filter by user's chapter
                startDateTime: { $gte: startOfToday } as any
            };

            if (search) {
                match.$or = [
                    { meetingTopic: { $regex: search, $options: "i" } },
                    { hotelName: { $regex: search, $options: "i" } },
                    { "location.name": { $regex: search, $options: "i" } },
                ];
            }

            const pipeline = [
                { $match: match },

                {
                    $lookup: {
                        from: "chapters",
                        localField: "chapters",
                        foreignField: "_id",
                        as: "chapters",
                    },
                },

                { $sort: { createdAt: -1 } },

                {
                    $facet: {
                        data: [{ $skip: page * limit }, { $limit: limit }],
                        meta: [{ $count: "total" }],
                    },
                },
            ];

            const result = await this.meetingRepository.aggregate(pipeline).toArray();

            const data = result[0]?.data || [];
            const total = result[0]?.meta[0]?.total || 0;

            return pagination(total, data, limit, page, res);
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    @Delete("/delete/:id")
    async deleteMeeting(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response,
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid meeting id");
            }

            const meeting = await this.meetingRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0,
            });

            if (!meeting) {
                return response(res, StatusCodes.NOT_FOUND, "Meeting not found");
            }

            meeting.isDelete = 1;
            meeting.updatedAt = new Date();
            meeting.updatedBy = new ObjectId(req.user.userId);

            await this.meetingRepository.save(meeting);

            return response(res, StatusCodes.OK, "Meeting deleted successfully");
        } catch (error: any) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/upcoming-list")
    async upcomingMeetings(@Req() req: RequestWithUser, @Res() res: Response) {
        try {
            // Get logged-in user's chapter
            const memberRepo = AppDataSource.getMongoRepository(Member);
            const member = await memberRepo.findOne({
                where: { _id: new ObjectId(req.user.userId) },
                select: ["chapter"],
            });

            if (!member || !member.chapter) {
                return response(
                    res,
                    StatusCodes.FORBIDDEN,
                    "Member not assigned to any chapter",
                );
            }

            const userChapterId = new ObjectId(member.chapter);
            const now = new Date();
            // Reset time to start of day if "today" includes past hours, 
            // BUT requirement says "future data and todaya based upcomming meeting list"
            // Usually upcoming means startDateTime >= now. 
            // If "today" implies the whole day, we might need start of today.
            // Interpreting "upcoming" strictly as >= now for safety, but strict >= might miss today's meeting if it started 1 min ago.
            // Let's use start of today to be safe and inclusive of today's meetings.
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const upcomingList = await this.meetingRepository.find({
                where: {
                    isDelete: 0,
                    isActive: 1,
                    chapters: { $in: [userChapterId] } as any,
                    startDateTime: { $gte: startOfToday } as any
                },
                order: {
                    startDateTime: "ASC"
                },
                select: {
                    meetingTopic: true,
                    startDateTime: true
                }
            });

            return response(
                res,
                StatusCodes.OK,
                "Upcoming meetings fetched successfully",
                upcomingList
            );

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    @Post("/assign-chief-guest")
    async assignChiefGuest(
        @Req() req: RequestWithUser,
        @Body() body: AssignChiefGuestDto,
        @Res() res: Response
    ) {
        try {
            const meetingRepo = AppDataSource.getMongoRepository(Meeting);
            const mobileGuestRepo = AppDataSource.getMongoRepository(MobileChiefGuest);
            const adminGuestRepo = AppDataSource.getMongoRepository(ChiefGuest);
            const assignRepo = AppDataSource.getMongoRepository(MeetingChiefGuest);

            // 1. Check Meeting Exists
            if (!ObjectId.isValid(body.meetingId)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid meeting ID");
            }
            const meeting = await meetingRepo.findOneBy({ _id: new ObjectId(body.meetingId), isDelete: 0 });
            if (!meeting) {
                return response(res, StatusCodes.NOT_FOUND, "Meeting not found");
            }

            // 2. Check Chief Guest Exists (in Mobile OR Admin collection)
            if (!ObjectId.isValid(body.chiefGuestId)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid chief guest ID");
            }

            const guestId = new ObjectId(body.chiefGuestId);
            const mobileGuest = await mobileGuestRepo.findOneBy({ _id: guestId, isDelete: 0 });
            const adminGuest = await adminGuestRepo.findOneBy({ _id: guestId, isDelete: 0 });

            if (!mobileGuest && !adminGuest) {
                return response(res, StatusCodes.NOT_FOUND, "Chief Guest not found in either list");
            }

            // 2.5 Check if already assigned
            const existingAssignment = await assignRepo.findOneBy({
                meetingId: new ObjectId(body.meetingId),
                chiefGuestId: guestId,
                isDelete: 0
            });

            if (existingAssignment) {
                return response(res, StatusCodes.CONFLICT, "Chief Guest already assigned to this meeting");
            }

            // 3. Create Assignment
            const assignment = assignRepo.create({
                meetingId: new ObjectId(body.meetingId),
                chiefGuestId: guestId,
                status: body.status,
                isActive: 1,
                isDelete: 0,
                createdBy: new ObjectId(req.user.userId),
                createdAt: new Date(),
                updatedBy: new ObjectId(req.user.userId),
                updatedAt: new Date()
            });

            const saved = await assignRepo.save(assignment);

            return response(res, StatusCodes.CREATED, "Chief Guest assigned successfully", saved);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    @Put("/update-assigned-chief-guest/:id")
    async updateAssignedChiefGuest(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Body() body: { status: string },
        @Res() res: Response
    ) {
        try {
            const assignRepo = AppDataSource.getMongoRepository(MeetingChiefGuest);

            if (!ObjectId.isValid(id)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid assignment ID");
            }

            const assignment = await assignRepo.findOneBy({ _id: new ObjectId(id), isDelete: 0 });
            if (!assignment) {
                return response(res, StatusCodes.NOT_FOUND, "Assignment not found");
            }

            if (body.status) {
                assignment.status = body.status;
            }

            assignment.updatedBy = new ObjectId(req.user.userId);
            assignment.updatedAt = new Date();

            const updated = await assignRepo.save(assignment);

            return response(res, StatusCodes.OK, "Assignment updated successfully", updated);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
}
