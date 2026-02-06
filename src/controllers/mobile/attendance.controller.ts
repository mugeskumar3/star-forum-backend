import {
    JsonController,
    Post,
    Put,
    Get,
    Param,
    Body,
    Req,
    Res,
    UseBefore
} from "routing-controllers";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { Meeting } from "../../entity/Meeting";
import { Training } from "../../entity/Training";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { response } from "../../utils";
import { Attendance } from "../../entity/Attendance";
import { Points } from "../../entity/Points";
import { UserPoints } from "../../entity/UserPoints";
import { UserPointHistory } from "../../entity/UserPointHistory";
import { AttendanceStatusEnum, BulkAttendanceDto, CreateAttendanceDto, UpdateAttendanceDto } from "../../dto/mobile/Attendance.dto";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/attendance")
export class AttendanceController {

    private attendanceRepo =
        AppDataSource.getMongoRepository(Attendance);

    private meetingRepo =
        AppDataSource.getMongoRepository(Meeting);

    private trainingRepo =
        AppDataSource.getMongoRepository(Training);

    private pointsRepo = AppDataSource.getMongoRepository(Points);
    private userPointsRepo = AppDataSource.getMongoRepository(UserPoints);
    private historyRepo = AppDataSource.getMongoRepository(UserPointHistory);

    @Post("/mark")
    async markAttendance(
        @Req() req: RequestWithUser,
        @Body() body: CreateAttendanceDto,
        @Res() res: Response
    ) {
        try {

            const memberId = new ObjectId(req.user.userId);
            const sourceId = new ObjectId(body.sourceId);
            const userId = new ObjectId(req.user.userId);

            let status = body.status;

            if (body.sourceType === "MEETING") {

                const meeting = await this.meetingRepo.findOneBy({
                    _id: sourceId,
                    isDelete: 0
                });

                if (!meeting)
                    return response(res, 404, "Meeting not found");

                const now = new Date();
                const lateTime = new Date(meeting.latePunchTime);

                if (now > lateTime) {
                    status = AttendanceStatusEnum.LATE;
                } else {
                    status = AttendanceStatusEnum.PRESENT;
                }
            }

            if (body.sourceType === "TRAINING") {

                const training = await this.trainingRepo.findOneBy({
                    _id: sourceId,
                    isDelete: 0
                });

                if (!training)
                    return response(res, 404, "Training not found");
            }

            const existing = await this.attendanceRepo.findOneBy({
                memberId,
                sourceId,
                sourceType: body.sourceType,
                isDelete: 0
            });

            if (existing) {

                existing.status = status;
                existing.userLocation = body.userLocation;
                existing.updatedBy = userId;
                existing.updatedAt = new Date();

                await this.attendanceRepo.save(existing);

                return response(
                    res,
                    200,
                    "Attendance updated successfully",
                    existing
                );
            }

            const attendance = new Attendance();

            attendance.memberId = memberId;
            attendance.sourceId = sourceId;
            attendance.sourceType = body.sourceType;
            attendance.status = status;
            attendance.userLocation = body.userLocation;
            attendance.createdBy = userId;
            attendance.isActive = 1;
            attendance.isDelete = 0;
            attendance.createdAt = new Date();

            const savedAttendance = await this.attendanceRepo.save(attendance);

            if (status === AttendanceStatusEnum.PRESENT) {
                let pointKey = "";
                if (body.sourceType === "MEETING") {
                    pointKey = "weekly_meetings";
                }
                else if (body.sourceType === "TRAINING") {
                    pointKey = "trainings";
                }

                if (pointKey) {
                    const pointConfig = await this.pointsRepo.findOne({
                        where: { key: pointKey, isActive: 1, isDelete: 0 }
                    });

                    if (pointConfig) {
                        await this.userPointsRepo.updateOne(
                            { userId, pointKey },
                            { $inc: { value: pointConfig.value } },
                            { upsert: true }
                        );

                        await this.historyRepo.save({
                            userId,
                            pointKey,
                            change: pointConfig.value,
                            source: body.sourceType,
                            sourceId: savedAttendance._id,
                            remarks: `${body.sourceType} Attendance Marked`,
                            createdAt: new Date()
                        });
                    }
                }
            }

            return response(
                res,
                StatusCodes.CREATED,
                "Attendance marked successfully",
                attendance
            );

        } catch (error: any) {
            return response(res, 500, error.message);
        }
    }


    @Put("/update/:id")
    async updateAttendance(
        @Param("id") id: string,
        @Body() body: UpdateAttendanceDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {

            if (!ObjectId.isValid(id)) {
                return response(res, 400, "Invalid attendance id");
            }

            const attendance = await this.attendanceRepo.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!attendance) {
                return response(res, 404, "Attendance not found");
            }

            if (body.status)
                attendance.status = body.status;

            if (body.userLocation)
                attendance.userLocation = body.userLocation;

            attendance.updatedBy = new ObjectId(req.user.userId);
            attendance.updatedAt = new Date();

            await this.attendanceRepo.save(attendance);

            return response(
                res,
                200,
                "Attendance updated successfully",
                attendance
            );

        } catch (error: any) {
            return response(res, 500, error.message);
        }
    }

    @Get("/source/:sourceType/:sourceId")
    async getBySource(
        @Param("sourceType") sourceType: "MEETING" | "TRAINING",
        @Param("sourceId") sourceId: string,
        @Res() res: Response
    ) {
        try {

            const list = await this.attendanceRepo.find({
                where: {
                    sourceType,
                    sourceId: new ObjectId(sourceId),
                    isDelete: 0
                } as any
            });

            return response(
                res,
                200,
                "Attendance fetched successfully",
                list
            );

        } catch (error: any) {
            return response(res, 500, error.message);
        }
    }

    @Get("/member/:memberId")
    async getMemberAttendance(
        @Param("memberId") memberId: string,
        @Res() res: Response
    ) {
        try {

            const list = await this.attendanceRepo.find({
                where: {
                    memberId: new ObjectId(memberId),
                    isDelete: 0
                } as any
            });

            return response(
                res,
                200,
                "Member attendance fetched successfully",
                list
            );

        } catch (error: any) {
            return response(res, 500, error.message);
        }
    }
    @Post("/admin/bulk-mark")
    async adminBulkAttendance(
        @Req() req: RequestWithUser,
        @Body() body: BulkAttendanceDto,
        @Res() res: Response
    ) {
        try {

            const adminId = new ObjectId(req.user.userId);
            const sourceId = new ObjectId(body.sourceId);
            const status = body.status || AttendanceStatusEnum.PRESENT;

            // Validate source
            if (body.sourceType === "MEETING") {
                const meeting = await this.meetingRepo.findOneBy({
                    _id: sourceId,
                    isDelete: 0
                });
                if (!meeting) return response(res, 404, "Meeting not found");
            }

            if (body.sourceType === "TRAINING") {
                const training = await this.trainingRepo.findOneBy({
                    _id: sourceId,
                    isDelete: 0
                });
                if (!training) return response(res, 404, "Training not found");
            }

            const bulkOps = body.members.map(memberId => ({
                updateOne: {
                    filter: {
                        memberId: new ObjectId(memberId),
                        sourceId,
                        sourceType: body.sourceType
                    },
                    update: {
                        $set: {
                            status: status,
                            updatedBy: adminId,
                            updatedAt: new Date(),
                            isDelete: 0
                        },
                        $setOnInsert: {
                            memberId: new ObjectId(memberId),
                            sourceId,
                            sourceType: body.sourceType,
                            createdBy: adminId,
                            isActive: 1,
                            createdAt: new Date()
                        }
                    },
                    upsert: true
                }
            }));

            await this.attendanceRepo.bulkWrite(bulkOps);

            return response(
                res,
                200,
                `Bulk attendance marked as ${status}`
            );

        } catch (error: any) {
            console.error(error);
            return response(res, 500, error.message);
        }
    }

}
