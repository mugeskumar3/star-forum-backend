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
  Delete,
  Patch,
} from "routing-controllers";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";

import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { AppDataSource } from "../../data-source";
import { Meeting } from "../../entity/Meeting";
import { handleErrorResponse, pagination, response } from "../../utils";
import { CreateMeetingDto } from "../../dto/admin/Meeting.dto";
import { Request, Response } from "express";
import { Chapter } from "../../entity/Chapter";
import { Attendance } from "../../entity/Attendance";

interface RequestWithUser extends Request {
  query: any;
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
@JsonController("/meetings")
export class MeetingController {
  private meetingRepository = AppDataSource.getMongoRepository(Meeting);

  @Post("/create")
  async createMeeting(
    @Req() req: RequestWithUser,
    @Body() body: CreateMeetingDto,
    @Res() res: Response,
  ) {
    try {
      const meeting = this.meetingRepository.create({
        meetingTopic: body.meetingTopic,
        meetingFee: body.meetingFee,
        visitorFee: body.visitorFee,
        hotelName: body.hotelName,

        chapters: body.chapters.map((id: string) => new ObjectId(id)),

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

      return response(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        error.message || "Something went wrong",
      );
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

      if (body.chapters?.length) {
        meeting.chapters = body.chapters.map((id) => new ObjectId(id));
      }

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
      return response(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        error.message || "Something went wrong",
      );
    }
  }

  @Get("/list")
  async listMeetings(@Req() req: RequestWithUser, @Res() res: Response) {
    try {
      const page = Math.max(Number(req.query.page) || 0, 0);
      const limit = Math.max(Number(req.query.limit) || 10, 1);

      const search = req.query.search?.toString();
      const chapter = req.query.chapter?.toString();
      const isActive = req.query.isActive?.toString();

      const match: any = { isDelete: 0 };

      if (search) {
        match.$or = [
          { meetingTopic: { $regex: search, $options: "i" } },
          { hotelName: { $regex: search, $options: "i" } },
          { "location.name": { $regex: search, $options: "i" } },
        ];
      }

      if (chapter) {
        match.chapters = { $in: [new ObjectId(chapter)] };
      }

      if (isActive !== undefined) {
        match.isActive = Number(isActive);
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

         {
        $sort: {
          isActive: -1,
          createdAt: -1
        }},

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

  @Get("/details/:id")
  async meetingDetails(
    @Param("id") id: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      if (!ObjectId.isValid(id)) {
        return response(res, StatusCodes.BAD_REQUEST, "Invalid meeting id");
      }

      const pipeline = [
        {
          $match: {
            _id: new ObjectId(id),
            isDelete: 0,
          },
        },
        {
          $lookup: {
            from: "chapters",
            localField: "chapters",
            foreignField: "_id",
            as: "chapters",
          },
        },
      ];

      const result = await this.meetingRepository.aggregate(pipeline).toArray();

      if (!result.length) {
        return response(res, StatusCodes.NOT_FOUND, "Meeting not found");
      }

      return response(
        res,
        StatusCodes.OK,
        "Meeting details fetched successfully",
        result[0],
      );
    } catch (error: any) {
      return response(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        error.message || "Something went wrong",
      );
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
      return response(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        error.message || "Something went wrong",
      );
    }
  }
  @Get("/attendance-list")
  async listAttendance(@Req() req: RequestWithUser, @Res() res: Response) {
    try {
      const page = Math.max(Number(req.query.page) || 0, 0);
      const limit = Math.max(Number(req.query.limit) || 10, 1);
      const search = req.query.search?.toString();

      const zoneId = req.query.zoneId?.toString();
      const regionId = req.query.regionId?.toString();
      const chapterId = req.query.chapterId?.toString();
      const memberId = req.query.memberId?.toString();

      const dateFilterType = req.query.type?.toString(); // 'month', 'year', 'custom'
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      const fromDate = req.query.fromDate?.toString();
      const toDate = req.query.toDate?.toString();

      const match: any = { isDelete: 0 };

      if (search) {
        match.$or = [
          { meetingTopic: { $regex: search, $options: "i" } },
          { hotelName: { $regex: search, $options: "i" } },
        ];
      }

      // --- Date Filtering ---
      if (dateFilterType === "month" && month && year) {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        match.startDateTime = { $gte: start, $lte: end };
      } else if (dateFilterType === "year" && year) {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);
        match.startDateTime = { $gte: start, $lte: end };
      } else if (dateFilterType === "custom" && fromDate && toDate) {
        match.startDateTime = {
          $gte: new Date(fromDate),
          $lte: new Date(toDate),
        };
      }

      // --- Hierarchy Filtering ---
      // If specific chapter is selected, use it directly.
      // If member is selected, filter by member's chapter (assuming member belongs to one chapter).
      // If region/zone selected, find chapters in that region/zone.

      let filterChapterIds: ObjectId[] = [];

      if (chapterId && ObjectId.isValid(chapterId)) {
        filterChapterIds.push(new ObjectId(chapterId));
      } else if (memberId && ObjectId.isValid(memberId)) {
        // If member is selected, get member's chapter
        const member = await AppDataSource.getMongoRepository(
          "Member",
        ).findOneBy({ _id: new ObjectId(memberId) });
        if (member && member.chapter) {
          filterChapterIds.push(new ObjectId(member.chapter));
        } else {
          // Member has no chapter or not found, maybe return empty or ignore?
          // Let's assume strict filtering: if member selected but no chapter, no results.
          filterChapterIds.push(new ObjectId()); // Dummy ID to force empty result
        }
      } else if (regionId && ObjectId.isValid(regionId)) {
        const chapters = await AppDataSource.getMongoRepository(Chapter).find({
          where: { regionId: new ObjectId(regionId), isDelete: 0 },
          select: { _id: 1 },
        });
        filterChapterIds = chapters.map((c) => c.id);
      } else if (zoneId && ObjectId.isValid(zoneId)) {
        const chapters = await AppDataSource.getMongoRepository(Chapter).find({
          where: { zoneId: new ObjectId(zoneId), isDelete: 0 },
          select: { _id: 1 },
        });
        filterChapterIds = chapters.map((c) => c.id);
      }

      if (filterChapterIds.length > 0) {
        // Match meetings that have ANY of the filtered chapters
        // Assuming 'chapters' in Meeting is an array of ObjectIds
        match.chapters = { $in: filterChapterIds };
      }

      const pipeline: any[] = [
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "chapters",
            localField: "chapters",
            foreignField: "_id",
            as: "chapterDetails",
          },
        },
        {
          $lookup: {
            from: "zones",
            localField: "chapterDetails.zoneId",
            foreignField: "_id",
            as: "zoneDetails",
          },
        },
        {
          $lookup: {
            from: "regions",
            localField: "chapterDetails.regionId",
            foreignField: "_id",
            as: "regionDetails",
          },
        },
        // Lookup Member Count (scoped to the meeting's chapters)
        {
          $lookup: {
            from: "member",
            let: { chapterIds: "$chapters" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $in: [
                          { $toString: "$chapter" },
                          {
                            $map: {
                              input: "$$chapterIds",
                              as: "cid",
                              in: { $toString: "$$cid" },
                            },
                          },
                        ],
                      },
                      { $in: ["$isActive", [1, "1", true]] },
                      { $in: ["$isDelete", [0, "0", false, null]] },
                    ],
                  },
                },
              },
              { $count: "count" },
            ],
            as: "memberStats",
          },
        },
        // Lookup Attendance Stats
        {
          $lookup: {
            from: "attendance",
            let: { meetingId: "$_id", meetingChapters: "$chapters" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$sourceId", "$$meetingId"] },
                      { $eq: ["$sourceType", "MEETING"] },
                      { $eq: ["$isActive", 1] },
                      { $eq: ["$isDelete", 0] },
                    ],
                  },
                },
              },
              {
                $lookup: {
                  from: "member",
                  localField: "memberId",
                  foreignField: "_id",
                  as: "member",
                },
              },
              { $unwind: "$member" },
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ["$member.chapter", "$$meetingChapters"] },
                      { $eq: ["$member.isActive", 1] },
                      { $eq: ["$member.isDelete", 0] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  present: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "present"] }, 1, 0],
                    },
                  },
                  absent: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "absent"] }, 1, 0],
                    },
                  },
                  totalAttendance: { $sum: 1 },
                },
              },
            ],
            as: "attendanceStats",
          },
        },
        {
          $facet: {
            data: [
              { $skip: page * limit },
              { $limit: limit },
              {
                $project: {
                  meetingTopic: 1,
                  meetingDate: "$startDateTime",
                  startDateTime: 1,
                  endDateTime: 1,
                  chapterNames: "$chapterDetails.chapterName",
                  zoneNames: "$zoneDetails.name",
                  regionNames: "$regionDetails.region",
                  totalMembers: {
                    $ifNull: [{ $arrayElemAt: ["$memberStats.count", 0] }, 0],
                  },
                  presentCount: {
                    $ifNull: [
                      { $arrayElemAt: ["$attendanceStats.present", 0] },
                      0,
                    ],
                  },
                  absentCount: {
                    $ifNull: [
                      { $arrayElemAt: ["$attendanceStats.absent", 0] },
                      0,
                    ],
                  },
                  createdAt: 1,
                },
              },
            ],
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
  @Get("/attendance-history-by-member")
  async getAttendanceHistoryByMember(
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const memberId = req.query.memberId as string;
      const page = Math.max(Number(req.query.page) || 0, 0);
      const limit = Math.max(Number(req.query.limit) || 10, 1);

      if (!memberId || !ObjectId.isValid(memberId)) {
        return response(
          res,
          StatusCodes.BAD_REQUEST,
          "Invalid or missing memberId"
        );
      }

      // 1. Fetch Member Basic Details (for the header)
      const memberRepository = AppDataSource.getMongoRepository("Member");
      const member = await memberRepository.findOne({
        where: { _id: new ObjectId(memberId) },
        select: ["fullName", "_id"],
      });

      if (!member) {
        return response(res, StatusCodes.NOT_FOUND, "Member not found");
      }

      // 2. Aggregate Attendance History
      const attendanceRepository = AppDataSource.getMongoRepository(Attendance);
      const match = {
        memberId: new ObjectId(memberId),
        isDelete: 0,
        isActive: 1,
      };

      const pipeline: any[] = [
        { $match: match },
        { $sort: { createdAt: -1 } }, // Temporary sort, will refine by eventDate later

        // Lookup Meeting
        {
          $lookup: {
            from: "meetings",
            localField: "sourceId",
            foreignField: "_id",
            as: "meetingDetails",
          },
        },
        // Lookup Training
        {
          $lookup: {
            from: "training", // Assuming collection name is 'training'
            localField: "sourceId",
            foreignField: "_id",
            as: "trainingDetails",
          },
        },

        // Determine Source Data
        {
          $addFields: {
            sourceData: {
              $cond: {
                if: { $eq: ["$sourceType", "MEETING"] },
                then: { $arrayElemAt: ["$meetingDetails", 0] },
                else: { $arrayElemAt: ["$trainingDetails", 0] },
              },
            },
          },
        },

        // Extract Common Fields
        {
          $addFields: {
            eventChapterIds: {
              $cond: {
                if: { $eq: ["$sourceType", "MEETING"] },
                then: "$sourceData.chapters",
                else: "$sourceData.chapterIds",
              },
            },
            eventDate: {
              $cond: {
                if: { $eq: ["$sourceType", "MEETING"] },
                then: "$sourceData.startDateTime",
                else: "$sourceData.trainingDateTime",
              },
            },
          },
        },

        // Lookup Chapters
        {
          $lookup: {
            from: "chapters",
            localField: "eventChapterIds",
            foreignField: "_id",
            as: "chapters",
          },
        },

        // Final Paging & Stats
        {
          $facet: {
            stats: [
              {
                $group: {
                  _id: null,
                  totalMeetings: { $sum: 1 },
                  totalPresent: {
                    $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
                  },
                  totalAbsent: {
                    $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
                  },
                },
              },
            ],
            history: [
              { $sort: { eventDate: -1 } },
              { $skip: page * limit },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  date: "$eventDate",
                  chapterName: { $arrayElemAt: ["$chapters.chapterName", 0] },
                  meetingType: {
                    $cond: {
                      if: { $eq: ["$sourceType", "MEETING"] },
                      then: "Weekly Meeting",
                      else: "Training",
                    },
                  },
                  status: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$status", "present"] }, then: "Present" },
                        { case: { $eq: ["$status", "absent"] }, then: "Absent" },
                        { case: { $eq: ["$status", "late"] }, then: "Late" },
                        { case: { $eq: ["$status", "medical"] }, then: "Medical" },
                        { case: { $eq: ["$status", "substitute"] }, then: "Substitute" },
                      ],
                      default: "$status",
                    },
                  },
                },
              },
            ],
          },
        },
      ];

      const result = await attendanceRepository.aggregate(pipeline).toArray();

      const stats = result[0]?.stats[0] || {
        totalMeetings: 0,
        totalPresent: 0,
        totalAbsent: 0,
      };
      const history = result[0]?.history || [];

      return response(res, StatusCodes.OK, "Attendance history fetched", {
        member: {
          id: member.id,
          name: member.fullName,
        },
        stats,
        history,
      });
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
  @Get("/attendance-list-by-source")
  async getAttendanceListBySource(
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const sourceId = req.query.sourceId as string;
      const sourceType = req.query.sourceType as string;
      const search = req.query.search?.toString();

      if (!sourceId || !ObjectId.isValid(sourceId)) {
        return response(
          res,
          StatusCodes.BAD_REQUEST,
          "Invalid or missing sourceId"
        );
      }
      if (!sourceType) {
        return response(res, StatusCodes.BAD_REQUEST, "Missing sourceType");
      }

      const page = Math.max(Number(req.query.page) || 0, 0);
      const limit = Math.max(Number(req.query.limit) || 10, 1);

      const attendanceRepository = AppDataSource.getMongoRepository(Attendance);

      const match: any = {
        sourceId: new ObjectId(sourceId),
        sourceType: sourceType,
        isDelete: 0,
        isActive: 1,
      };

      const pipeline: any[] = [
        { $match: match },
        {
          $lookup: {
            from: "member",
            localField: "memberId",
            foreignField: "_id",
            as: "member",
          },
        },
        { $unwind: "$member" },
        {
          $lookup: {
            from: "businesscategories",
            localField: "member.businessCategory",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $unwind: {
            path: "$category",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Search filter
        ...(search
          ? [
            {
              $match: {
                $or: [
                  { "member.fullName": { $regex: search, $options: "i" } },
                  { "member.phoneNumber": { $regex: search, $options: "i" } },
                  { "member.companyName": { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
          : []),
        {
          $facet: {
            data: [
              { $skip: page * limit },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  status: 1,
                  memberName: "$member.fullName",
                  memberMobile: "$member.phoneNumber",
                  companyName: "$member.companyName",
                  categoryName: "$category.name",
                  memberId: "$member._id",
                },
              },
            ],
            meta: [{ $count: "total" }],
          },
        },
      ];

      const result = await attendanceRepository.aggregate(pipeline).toArray();
      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);
      return pagination(total, data, limit, page, res);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/absent-proxy-report")
  async getAbsentAndProxyReport(
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const page = Math.max(Number(req.query.page) || 0, 0);
      const limit = Math.max(Number(req.query.limit) || 10, 1);
      const search = req.query.search?.toString();

      // Filters
      const chapterId = req.query.chapterId?.toString();
      const zoneId = req.query.zoneId?.toString();
      const regionId = req.query.regionId?.toString();

      const period = req.query.period?.toString(); // current_month, tenure_1, tenure_2, one_year, overall
      const attendanceRepository = AppDataSource.getMongoRepository(Attendance);

      const match: any = {
        isDelete: 0,
        isActive: 1,
      };

      // --- Date Filtering Logic ---
      if (period && period !== "overall") {
        const now = new Date();
        const currentYear = now.getFullYear();
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (period === "current_month") {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (period === "tenure_1") {
          startDate = new Date(currentYear, 0, 1); // Jan 1st
          endDate = new Date(currentYear, 5, 30, 23, 59, 59, 999); // June 30th
        } else if (period === "tenure_2") {
          startDate = new Date(currentYear, 6, 1); // July 1st
          endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999); // Dec 31st
        } else if (period === "one_year") {
          // Providing current calendar year as "One Year"
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        }

        if (startDate && endDate) {
          match.createdAt = {
            $gte: startDate,
            $lte: endDate
          };
        }
      }

      const pipeline: any[] = [
        { $match: match },
        // Group by Member
        {
          $group: {
            _id: "$memberId",
            totalAbsent: {
              $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] }
            },
            totalProxy: {
              $sum: { $cond: [{ $eq: ["$status", "proxcy"] }, 1, 0] }
            }
          }
        },
        // Lookup Member Details first to get Chapter ID
        {
          $lookup: {
            from: "member",
            localField: "_id",
            foreignField: "_id",
            as: "member"
          }
        },
        { $unwind: "$member" },

        // Lookup Chapter Details to get limits
        {
          $lookup: {
            from: "chapters",
            localField: "member.chapter",
            foreignField: "_id",
            as: "chapterDetails"
          }
        },
        { $unwind: { path: "$chapterDetails", preserveNullAndEmptyArrays: true } },

        // Filter based on Dynamic Limits from Chapter
        {
          $match: {
            $expr: {
              $gt: ["$totalAbsent", { $ifNull: ["$chapterDetails.absentLimit", 3] }] // Default 3 if not set
            }
          }
        },

        // Apply Hierarchical Filters
        ...(chapterId ? [{ $match: { "chapterDetails._id": new ObjectId(chapterId) } }] : []),
        ...(zoneId ? [{ $match: { "chapterDetails.zoneId": new ObjectId(zoneId) } }] : []),
        ...(regionId ? [{ $match: { "chapterDetails.regionId": new ObjectId(regionId) } }] : []),

        // Lookup Business Category
        {
          $lookup: {
            from: "businesscategories",
            localField: "member.businessCategory",
            foreignField: "_id",
            as: "categoryDetails"
          }
        },
        { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },

        // Search Filter
        ...(search ? [{
          $match: {
            $or: [
              { "member.fullName": { $regex: search, $options: "i" } },
              { "member.phoneNumber": { $regex: search, $options: "i" } },
              { "chapterDetails.chapterName": { $regex: search, $options: "i" } }
            ]
          }
        }] : []),


        {
          $facet: {
            data: [
              { $skip: page * limit },
              { $limit: limit },
              {
                $project: {
                  _id: 1, // Member ID
                  name: "$member.fullName",
                  mobileNumber: "$member.phoneNumber",
                  chapterName: "$chapterDetails.chapterName",
                  categoryName: "$categoryDetails.name",
                  totalAbsent: 1,
                  totalProxy: 1,
                  absentLimit: { $ifNull: ["$chapterDetails.absentLimit", 3] }
                  // For "History" action, frontend can use _id (memberId) to call /attendance-history-by-member
                }
              }
            ],
            meta: [{ $count: "total" }]
          }
        }
      ];

      const result = await attendanceRepository.aggregate(pipeline).toArray();
      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/absent-proxy-history/:memberId")
  async getAbsentProxyHistory(
    @Param("memberId") memberId: string,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      if (!ObjectId.isValid(memberId)) {
        return response(res, StatusCodes.BAD_REQUEST, "Invalid memberId");
      }

      const page = Math.max(Number(req.query.page) || 0, 0);
      const limit = Math.max(Number(req.query.limit) || 10, 1);

      const attendanceRepository = AppDataSource.getMongoRepository(Attendance);

      const match: any = {
        memberId: new ObjectId(memberId),
        status: { $in: ["absent", "substitute"] },
        isDelete: 0,
        isActive: 1
      };

      const pipeline: any[] = [
        { $match: match },
        { $sort: { createdAt: -1 } },

        // 1. Lookup Source (Meeting / Training)
        {
          $lookup: {
            from: "meetings",
            localField: "sourceId",
            foreignField: "_id",
            as: "meetingDetails"
          }
        },
        // We assume Training lookup logic if needed, but request emphasizes 'Meeting data'. 
        // If source is Meeting, we use meetingDetails.

        {
          $addFields: {
            meetingData: { $arrayElemAt: ["$meetingDetails", 0] }
          }
        },

        // 2. Lookup Member & Category
        {
          $lookup: {
            from: "member",
            localField: "memberId",
            foreignField: "_id",
            as: "member"
          }
        },
        { $unwind: "$member" },
        {
          $lookup: {
            from: "businesscategories",
            localField: "member.businessCategory",
            foreignField: "_id",
            as: "category"
          }
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

        // 3. Lookup Chapter from Meeting (Assuming meeting has chapters array, usually we take the first matching or the detailed one)
        // Since a meeting can have multiple chapters, but a member belongs to ONE chapter, 
        // we should probably show the Member's Chapter or the Meeting's Chapter info.
        // User asks for "Zone, Chapter". Usually implies the chapter context of the meeting or the member.
        // Let's rely on the Member's Chapter for the report row context, OR the meeting's chapter if clearer.
        // However, attendance is usually marked for a specific chapter meeting.
        // Let's use Member's chapter as primary context for "Chapter Name" in list, 
        // OR if the meeting is multi-chapter, we might need to be specific. 
        // Given the report context, Member's properties seem safest for "Category" and "Chapter".

        {
          $lookup: {
            from: "chapters",
            localField: "member.chapter",
            foreignField: "_id",
            as: "chapterDetails"
          }
        },
        { $unwind: { path: "$chapterDetails", preserveNullAndEmptyArrays: true } },

        // 4. Lookup Zone from Chapter
        {
          $lookup: {
            from: "zones",
            localField: "chapterDetails.zoneId",
            foreignField: "_id",
            as: "zoneDetails"
          }
        },
        { $unwind: { path: "$zoneDetails", preserveNullAndEmptyArrays: true } },

        {
          $project: {
            _id: 1, // Attendance ID
            meetingDate: { $ifNull: ["$meetingData.startDateTime", "$createdAt"] }, // Fallback to createdAt if not meeting
            meetingTopic: "$meetingData.meetingTopic",
            location: "$meetingData.location",
            zoneName: "$zoneDetails.name",
            chapterName: "$chapterDetails.chapterName",
            categoryName: "$category.name",
            status: {
              $cond: { if: { $eq: ["$status", "substitute"] }, then: "Proxy", else: "Absent" }
            },
            meetingType: "$sourceType", // MEETING or TRAINING
            // Member details (repeated per row or just available)
            memberId: "$member._id",
            memberName: "$member.fullName",
            memberImage: "$member.profileImage",
            memberNumber: "$member.phoneNumber"
          }
        },

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

      const result = await attendanceRepository.aggregate(pipeline).toArray();
      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
   @Patch("/:id/toggle-active")
    async toggleActive(@Param("id") id: string, @Res() res: Response) {
      try {
        const meeting = await this.meetingRepository.findOneBy({
          _id: new ObjectId(id),
          isDelete: 0
        });
  
        if (!meeting) {
          return response(res, StatusCodes.NOT_FOUND, "Meeting not found");
        }
  
        meeting.isActive = meeting.isActive === 1 ? 0 : 1;
        const updatedMeeting = await this.meetingRepository.save(meeting);
        return response(
          res,
          StatusCodes.OK,
          `Meeting ${meeting.isActive === 1 ? "enabled" : "disabled"} successfully`,
          updatedMeeting
        );
      } catch (error) {
        return handleErrorResponse(error, res);
      }
    }
}
