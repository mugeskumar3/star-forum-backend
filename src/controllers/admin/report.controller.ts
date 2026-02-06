import {
  JsonController,
  Get,
  Res,
  QueryParams,
  UseBefore,
  Req
} from "routing-controllers";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import pagination from "../../utils/pagination";
import response from "../../utils/response";
import { StatusCodes } from "http-status-codes";
import { ObjectId } from "mongodb";

import { OneToOneMeeting } from "../../entity/121's";
import { Referral } from "../../entity/Referral";
import { Visitor } from "../../entity/Visitor";
import { MobileChiefGuest } from "../../entity/MobileChiefGuest";
import { PowerDate } from "../../entity/PowerDate";
import { Training } from "../../entity/Training";
import { UserPoints } from "../../entity/UserPoints";
import { ThankYouSlip } from "../../entity/ThankyouSlip";
import { Chapter } from "../../entity/Chapter";
import { Member } from "../../entity/Member";
interface RequestWithUser extends Request {
  query: any;
  user: AuthPayload;
}
@UseBefore(AuthMiddleware)
@JsonController("/reports")
export class ReportController {

  private oneToOneRepo =
    AppDataSource.getMongoRepository(OneToOneMeeting);

  private referralRepo =
    AppDataSource.getMongoRepository(Referral);
  private chiefGuestRepo =
    AppDataSource.getMongoRepository(MobileChiefGuest);
  private powerDateRepo =
    AppDataSource.getMongoRepository(PowerDate);
  private trainingRepo =
    AppDataSource.getMongoRepository(Training);
  private thankYouRepo =
    AppDataSource.getMongoRepository(ThankYouSlip);
  private memberRepo =
    AppDataSource.getMongoRepository(Member);
  @Get("/one-to-one-report")
  async getOneToOneReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 10);
      const search = query.search?.trim();

      const match: any = {
        isActive: 1,
        isDelete: 0
      };

      const pipeline: any[] = [

        { $match: match },

        // Initiator
        {
          $lookup: {
            from: "member",
            let: { initiatorId: "$initiatedById" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$initiatorId"] }
                }
              },
              { $project: { _id: 1, fullName: 1, chapter: 1 } }
            ],
            as: "initiator"
          }
        },
        { $unwind: { path: "$initiator", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "chapters",
            localField: "initiator.chapter",
            foreignField: "_id",
            as: "chapter"
          }
        },
        { $unwind: { path: "$chapter", preserveNullAndEmptyArrays: true } },

        ...(query.chapterId && ObjectId.isValid(query.chapterId)
          ? [{ $match: { "chapter._id": new ObjectId(query.chapterId) } }]
          : []),

        ...(query.zoneId && ObjectId.isValid(query.zoneId)
          ? [{ $match: { "chapter.zoneId": new ObjectId(query.zoneId) } }]
          : []),

        ...(query.edId && ObjectId.isValid(query.edId)
          ? [{ $match: { "chapter.edId": new ObjectId(query.edId) } }]
          : []),

        ...(query.rdId && ObjectId.isValid(query.rdId)
          ? [{ $match: { "chapter.rdId": new ObjectId(query.rdId) } }]
          : []),

        {
          $lookup: {
            from: "member",
            let: { metWithId: "$meetingWithMemberId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$metWithId"] }
                }
              },
              { $project: { _id: 1, fullName: 1 } }
            ],
            as: "metWith"
          }
        },
        { $unwind: { path: "$metWith", preserveNullAndEmptyArrays: true } },

        ...(search
          ? [{
            $match: {
              $or: [
                { "initiator.fullName": { $regex: search, $options: "i" } },
                { "metWith.fullName": { $regex: search, $options: "i" } }
              ]
            }
          }]
          : []),

        { $sort: { meetingDateTime: -1 } },

        {
          $project: {
            _id: 1,
            meetingDateTime: 1,
            initiatedBy: 1,
            meetingLocation: 1,
            topicDiscussed: 1,
            photos: 1,

            memberName: "$initiator.fullName",
            metWithName: "$metWith.fullName",
            chapterName: "$chapter.chapterName",
            chapterId: "$chapter._id",
          }
        }
      ];

      if (limit > 0) {
        pipeline.push({ $skip: page * limit }, { $limit: limit });
      }

      const data = await this.oneToOneRepo.aggregate(pipeline).toArray();
      const totalCount = await this.oneToOneRepo.countDocuments(match);

      return pagination(totalCount, data, limit, page, res);

    } catch (error) {
      console.error(error);
      return response(res, StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to fetch 121 report");
    }
  }

  @Get("/referral-report")
  async getReferralReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 10);
      const search = query.search?.trim();

      const match = { isDelete: 0 };

      const pipeline: any[] = [

        { $match: match },

        {
          $lookup: {
            from: "member",
            let: { fromId: "$fromMemberId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$fromId"] }
                }
              },
              { $project: { _id: 1, fullName: 1, chapter: 1 } }
            ],
            as: "fromMember"
          }
        },
        { $unwind: "$fromMember" },

        {
          $lookup: {
            from: "chapters",
            localField: "fromMember.chapter",
            foreignField: "_id",
            as: "chapter"
          }
        },
        { $unwind: "$chapter" },

        ...(query.chapterId && ObjectId.isValid(query.chapterId)
          ? [{ $match: { "chapter._id": new ObjectId(query.chapterId) } }]
          : []),

        ...(query.zoneId && ObjectId.isValid(query.zoneId)
          ? [{ $match: { "chapter.zoneId": new ObjectId(query.zoneId) } }]
          : []),

        ...(query.edId && ObjectId.isValid(query.edId)
          ? [{ $match: { "chapter.edId": new ObjectId(query.edId) } }]
          : []),

        ...(query.rdId && ObjectId.isValid(query.rdId)
          ? [{ $match: { "chapter.rdId": new ObjectId(query.rdId) } }]
          : []),

        {
          $lookup: {
            from: "member",
            let: { toId: "$toMemberId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$toId"] }
                }
              },
              { $project: { _id: 1, fullName: 1 } }
            ],
            as: "toMember"
          }
        },
        { $unwind: { path: "$toMember", preserveNullAndEmptyArrays: true } },

        ...(search
          ? [{
            $match: {
              $or: [
                { "fromMember.fullName": { $regex: search, $options: "i" } },
                { "toMember.fullName": { $regex: search, $options: "i" } },
                { referralName: { $regex: search, $options: "i" } }
              ]
            }
          }]
          : []),

        { $sort: { createdAt: -1 } },

        {
          $project: {
            _id: 1,
            createdAt: 1,

            memberName: "$fromMember.fullName",
            referralTo: "$toMember.fullName",

            type: "$referralType",
            status: "$status",
            referralName: 1,
            telephone: 1,
            email: 1,
            address: 1,
            toldWouldCall: 1,
            givenCard: 1,
            comments: 1,
            temp: {
              $cond: [
                { $gte: ["$rating", 4] }, "Hot",
                {
                  $cond: [
                    { $eq: ["$rating", 3] }, "Warm",
                    "Cold"
                  ]
                }
              ]
            }
          }
        }
      ];

      if (limit > 0) {
        pipeline.push({ $skip: page * limit }, { $limit: limit });
      }

      const data = await this.referralRepo.aggregate(pipeline).toArray();
      const totalCount = await this.referralRepo.countDocuments(match);

      return pagination(totalCount, data, limit, page, res);

    } catch (error) {
      console.error(error);
      return response(res, StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to fetch referral report");
    }
  }
  @Get("/visitor-report")
  @UseBefore(AuthMiddleware)
  async getVisitorReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 10);
      const search = query.search?.trim();

      const match: any = {
        isActive: 1,
        isDelete: 0
      };

      const pipeline: any[] = [

        { $match: match },

        {
          $lookup: {
            from: "member",
            let: { memberId: "$createdBy" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$memberId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: 1,
                  chapter: 1
                }
              }
            ],
            as: "invitedBy"
          }
        },
        {
          $unwind: {
            path: "$invitedBy",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "chapters",
            localField: "chapterId",
            foreignField: "_id",
            as: "chapter"
          }
        },
        {
          $unwind: {
            path: "$chapter",
            preserveNullAndEmptyArrays: true
          }
        },

        ...(query.chapterId && ObjectId.isValid(query.chapterId)
          ? [{ $match: { "chapter._id": new ObjectId(query.chapterId) } }]
          : []),

        ...(query.zoneId && ObjectId.isValid(query.zoneId)
          ? [{ $match: { "chapter.zoneId": new ObjectId(query.zoneId) } }]
          : []),

        ...(query.edId && ObjectId.isValid(query.edId)
          ? [{ $match: { "chapter.edId": new ObjectId(query.edId) } }]
          : []),

        ...(query.rdId && ObjectId.isValid(query.rdId)
          ? [{ $match: { "chapter.rdId": new ObjectId(query.rdId) } }]
          : []),

        ...(search
          ? [{
            $match: {
              $or: [
                { visitorName: { $regex: search, $options: "i" } },
                { contactNumber: { $regex: search, $options: "i" } },
                { companyName: { $regex: search, $options: "i" } },
                { "invitedBy.fullName": { $regex: search, $options: "i" } },
                { businessCategory: { $regex: search, $options: "i" } }
              ]
            }
          }]
          : []),

        { $sort: { createdAt: -1 } },

        {
          $project: {
            _id: 1,

            date: "$visitorDate",
            visitorName: 1,
            contactNumber: 1,
            businessCategory: 1,
            companyName: 1,

            sourceOfEvent: "$status",

            invitedBy: "$invitedBy.fullName",

            chapterId: "$chapter._id",
            chapterName: "$chapter.name"
          }
        }
      ];

      if (limit > 0) {
        pipeline.push(
          { $skip: page * limit },
          { $limit: limit }
        );
      }

      const visitorRepo =
        AppDataSource.getMongoRepository(Visitor);

      const data = await visitorRepo.aggregate(pipeline).toArray();

      const totalCount =
        await visitorRepo.countDocuments(match);

      return pagination(
        totalCount,
        data,
        limit,
        page,
        res
      );

    } catch (error) {
      console.error(error);
      return response(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to fetch visitor report"
      );
    }
  }
  @Get("/chief-guests-report")
  async chiefGuestReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 10, 1);
      const search = query.search?.toString();
      const chapterId = query.chapterId;
      const zoneId = query.zoneId;
      const edId = query.edId;
      const rdId = query.rdId;

      const match: any = {
        isDelete: 0,
        isActive: 1
      };

      const pipeline: any[] = [

        { $match: match },

        // 🔹 Invited By (Member)
        {
          $lookup: {
            from: "member",
            localField: "createdBy",
            foreignField: "_id",
            as: "invitedBy"
          }
        },
        { $unwind: "$invitedBy" },

        // 🔹 Chapter
        {
          $lookup: {
            from: "chapters",
            localField: "invitedBy.chapter",
            foreignField: "_id",
            as: "chapter"
          }
        },
        { $unwind: "$chapter" },

        // 🔹 Optional Filters
        ...(chapterId
          ? [{
            $match: {
              "chapter._id": new ObjectId(chapterId)
            }
          }]
          : []),

        ...(zoneId
          ? [{
            $match: {
              "chapter.zoneId": new ObjectId(zoneId)
            }
          }]
          : []),

        ...(edId
          ? [{
            $match: {
              "chapter.edId": new ObjectId(edId)
            }
          }]
          : []),

        ...(rdId
          ? [{
            $match: {
              "chapter.rdId": new ObjectId(rdId)
            }
          }]
          : []),

        {
          $project: {
            _id: 1,
            date: "$createdAt",
            chiefGuestName: 1,
            contactNumber: 1,
            businessCategory: 1,
            businessName: 1,
            sourceType: 1,
            invitedBy: "$invitedBy.fullName",
            chapter: "$chapter.chapterName"
          }
        },
        ...(search ? [{
          $match: {
            $or: [
              { chiefGuestName: { $regex: search, $options: "i" } },
              { contactNumber: { $regex: search, $options: "i" } },
              { businessCategory: { $regex: search, $options: "i" } },
              { businessName: { $regex: search, $options: "i" } },
              { sourceType: { $regex: search, $options: "i" } },
              { invitedBy: { $regex: search, $options: "i" } },
              { chapter: { $regex: search, $options: "i" } }
            ]
          }
        }] : []),


        {
          $facet: {
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: page * limit },
              { $limit: limit }
            ],
            meta: [
              { $count: "total" }
            ]
          }
        }
      ];

      const result =
        await this.chiefGuestRepo.aggregate(pipeline).toArray();

      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (error) {
      console.error(error);
      return response(res, 500, "Failed to fetch chief guest report");
    }
  }
  @Get("/power-dates-report")
  async powerDateReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 10, 1);
      const search = query.search?.toString();

      const chapterId = query.chapterId;
      const zoneId = query.zoneId;
      const regionId = query.regionId;
      const edId = query.edId;
      const rdId = query.rdId;

      const pipeline: any[] = [

        // Active Power Dates
        {
          $match: {
            isDelete: 0,
            isActive: 1
          }
        },

        // Creator → Member
        {
          $lookup: {
            from: "member",
            localField: "createdBy",
            foreignField: "_id",
            as: "creator"
          }
        },
        { $unwind: "$creator" },

        // Chapter
        {
          $lookup: {
            from: "chapters",
            localField: "creator.chapter",
            foreignField: "_id",
            as: "chapter"
          }
        },
        { $unwind: "$chapter" },

        // Members invited
        {
          $lookup: {
            from: "member",
            localField: "members",
            foreignField: "_id",
            as: "invitedMembers"
          }
        },

        // 🔹 Filters
        ...(chapterId ? [{
          $match: { "chapter._id": new ObjectId(chapterId) }
        }] : []),

        ...(zoneId ? [{
          $match: { "chapter.zoneId": new ObjectId(zoneId) }
        }] : []),

        ...(regionId ? [{
          $match: { "chapter.regionId": new ObjectId(regionId) }
        }] : []),

        ...(edId ? [{
          $match: { "chapter.edId": new ObjectId(edId) }
        }] : []),

        ...(rdId ? [{
          $match: { "chapter.rdId": new ObjectId(rdId) }
        }] : []),

        // 🔹 Compute fields
        {
          $addFields: {

            invitedTo: {
              $map: {
                input: "$invitedMembers",
                as: "m",
                in: "$$m.fullName"
              }
            },

            referralTemp: {
              $switch: {
                branches: [
                  { case: { $gte: ["$rating", 5] }, then: "Hot" },
                  { case: { $gte: ["$rating", 3] }, then: "Warm" }
                ],
                default: "Cold"
              }
            }
          }
        },
        ...(search
          ? [{
            $match: {
              $or: [
                { "creator.fullName": { $regex: search, $options: "i" } },

                { invitedTo: { $elemMatch: { $regex: search, $options: "i" } } },

                { meetingStatus: { $regex: search, $options: "i" } },

                { name: { $regex: search, $options: "i" } },

                { comments: { $regex: search, $options: "i" } },

                { referralTemp: { $regex: search, $options: "i" } }
              ]
            }
          }]
          : []),

        {
          $project: {
            _id: 1,
            date: "$createdAt",
            memberName: "$creator.fullName",
            invitedTo: 1,
            meetingStatus: 1,
            name: "$name",
            comments: 1,
            referralTemp: 1,
            phoneNumber: 1,
            email: 1,
            address: 1

          }
        },

        // Pagination
        {
          $facet: {
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: page * limit },
              { $limit: limit }
            ],
            meta: [{ $count: "total" }]
          }
        }
      ];

      const result =
        await this.powerDateRepo.aggregate(pipeline).toArray();

      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (error) {
      console.error(error);
      return response(res, 500, "Failed to fetch power date report");
    }
  }
  @Get("/trainings-report")
  async trainingReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 10, 1);

      const search = query.search?.toString();
      const chapterId = query.chapterId;
      const zoneId = query.zoneId;
      const regionId = query.regionId;
      const edId = query.edId;
      const rdId = query.rdId;

      const pipeline: any[] = [

        // 1️⃣ Base match
        {
          $match: {
            isDelete: 0,
            isActive: 1
          }
        },

        // 2️⃣ Chapter Lookup (projected)
        {
          $lookup: {
            from: "chapters",
            let: { chapterIds: "$chapterIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$_id", "$$chapterIds"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  zoneId: 1,
                  regionId: 1,
                  edId: 1,
                  rdId: 1
                }
              }
            ],
            as: "chapters"
          }
        },

        // 3️⃣ Trainer Lookup (projected)
        {
          $lookup: {
            from: "adminusers",
            let: { trainerIds: "$trainerIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$_id", "$$trainerIds"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: "$name"
                }
              }
            ],
            as: "trainers"
          }
        },

        // 4️⃣ Filters
        ...(chapterId
          ? [{ $match: { "chapters._id": new ObjectId(chapterId) } }]
          : []),

        ...(zoneId
          ? [{ $match: { "chapters.zoneId": new ObjectId(zoneId) } }]
          : []),

        ...(regionId
          ? [{ $match: { "chapters.regionId": new ObjectId(regionId) } }]
          : []),

        ...(edId
          ? [{ $match: { "chapters.edId": new ObjectId(edId) } }]
          : []),

        ...(rdId
          ? [{ $match: { "chapters.rdId": new ObjectId(rdId) } }]
          : []),

        ...(search
          ? [{
            $match: {
              $or: [
                { title: { $regex: search, $options: "i" } },
                { "trainers.fullName": { $regex: search, $options: "i" } }
              ]
            }
          }]
          : []),

        // 5️⃣ Final projection
        {
          $project: {
            _id: 1,
            date: "$trainingDateTime",
            title: 1,
            trainerNames: {
              $map: {
                input: "$trainers",
                as: "t",
                in: "$$t.fullName"
              }
            },
            location: "$locationOrLink",
            status: 1
          }
        },

        // 6️⃣ Pagination
        {
          $facet: {
            data: [
              { $sort: { date: -1 } },
              { $skip: page * limit },
              { $limit: limit }
            ],
            meta: [{ $count: "total" }]
          }
        }
      ];

      const result =
        await this.trainingRepo.aggregate(pipeline).toArray();

      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (error) {
      console.error(error);
      return response(res, 500, "Failed to fetch training report");
    }
  }

  @Get("/chapter-report")
  async getChapterReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {
      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 10, 1);
      const search = query.search?.toString();

      const zoneId = query.zoneId;
      const regionId = query.regionId;
      const edId = query.edId;
      const rdId = query.rdId;

      const match: any = {
        isDelete: 0,
        isActive: 1
      };

      if (zoneId) match.zoneId = new ObjectId(zoneId);
      if (regionId) match.regionId = new ObjectId(regionId);
      if (edId) match.edId = new ObjectId(edId);
      if (rdId) match.rdId = new ObjectId(rdId);

      if (search) {
        match.chapterName = { $regex: search, $options: "i" };
      }

      const pipeline: any[] = [
        { $match: match },

        // 🔹 Lookups for ED, RD, Zone to display names
        {
          $lookup: {
            from: "member",
            localField: "edId",
            foreignField: "_id",
            as: "ed"
          }
        },
        { $unwind: { path: "$ed", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "member",
            localField: "rdId",
            foreignField: "_id",
            as: "rd"
          }
        },
        { $unwind: { path: "$rd", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "zones",
            localField: "zoneId",
            foreignField: "_id",
            as: "zone"
          }
        },
        { $unwind: { path: "$zone", preserveNullAndEmptyArrays: true } },

        // 🔹 GET MEMBERS of this chapter
        {
          $lookup: {
            from: "member",
            let: { chapterId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chapter", "$$chapterId"] },
                      { $eq: ["$isDelete", 0] },
                      { $eq: ["$isActive", 1] }
                    ]
                  }
                }
              },
              { $project: { _id: 1 } }
            ],
            as: "members"
          }
        },
        {
          $addFields: {
            memberIds: { $map: { input: "$members", as: "m", in: "$$m._id" } },
            totalMembers: { $size: "$members" }
          }
        },

        // 🔹 AGGREGATE STATS based on memberIds

        // 1. OneToOne (Initiated By Member)
        {
          $lookup: {
            from: "one_to_one_meetings",
            let: { mIds: "$memberIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$initiatedById", "$$mIds"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "oneToOneStats"
          }
        },

        // 2. Referrals (From Member)
        {
          $lookup: {
            from: "referrals",
            let: { mIds: "$memberIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$fromMemberId", "$$mIds"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "referralStats"
          }
        },

        // 3. Visitors (Created By Member)
        {
          $lookup: {
            from: "visitors",
            let: { mIds: "$memberIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$createdBy", "$$mIds"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "visitorStats"
          }
        },

        // 4. Chief Guests (Created By Member)
        {
          $lookup: {
            from: "mobile_chief_guest",
            let: { mIds: "$memberIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$createdBy", "$$mIds"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "chiefGuestStats"
          }
        },

        // 5. Power Dates (Created By Member)
        {
          $lookup: {
            from: "power_date",
            let: { mIds: "$memberIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$createdBy", "$$mIds"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "powerDateStats"
          }
        },

        // 6. Trainings (Attendance: source=TRAINING)
        {
          $lookup: {
            from: "attendance",
            let: { mIds: "$memberIds" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ["$memberId", "$$mIds"] },
                      { $eq: ["$sourceType", "TRAINING"] },
                      { $eq: ["$status", "present"] },
                      { $eq: ["$isDelete", 0] }
                    ]
                  }
                }
              },
              { $count: "count" }
            ],
            as: "trainingStats"
          }
        },

        // 7. Thank You Slips (Given By Member - createdBy)
        {
          $lookup: {
            from: "thank_you_slips",
            let: { mIds: "$memberIds" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$createdBy", "$$mIds"] },
                  isDelete: 0
                }
              },
              { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
            ],
            as: "thankYouStats"
          }
        },

        // 🔹 Final Project
        {
          $project: {
            _id: 1,
            chapterName: 1,
            location: 1,
            zoneName: "$zone.name",
            zoneState: "$zone.state",
            edName: "$ed.fullName",
            rdName: "$rd.fullName",
            totalMembers: 1,
            oneToOneCount: { $ifNull: [{ $arrayElemAt: ["$oneToOneStats.count", 0] }, 0] },
            referralCount: { $ifNull: [{ $arrayElemAt: ["$referralStats.count", 0] }, 0] },
            visitorCount: { $ifNull: [{ $arrayElemAt: ["$visitorStats.count", 0] }, 0] },
            chiefGuestCount: { $ifNull: [{ $arrayElemAt: ["$chiefGuestStats.count", 0] }, 0] },
            powerDateCount: { $ifNull: [{ $arrayElemAt: ["$powerDateStats.count", 0] }, 0] },
            trainingCount: { $ifNull: [{ $arrayElemAt: ["$trainingStats.count", 0] }, 0] },
            thankYouSlipAmount: { $ifNull: [{ $arrayElemAt: ["$thankYouStats.totalAmount", 0] }, 0] },
            createdAt: 1
          }
        },

        { $sort: { createdAt: -1 } },

        // 🔹 Facet for pagination
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

      const chapterRepo = AppDataSource.getMongoRepository(Chapter);
      const result = await chapterRepo.aggregate(pipeline).toArray();

      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (error) {
      console.error(error);
      return response(res, 500, "Failed to fetch chapter report");
    }
  }
  @Get("/chapter-member-report")
  async getChapterMemberActivities(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {
      const chapterId = query.chapterId;
      if (!chapterId || !ObjectId.isValid(chapterId)) {
        return response(res, StatusCodes.BAD_REQUEST, "Invalid or missing Chapter ID");
      }

      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 10, 1);
      const search = query.search?.toString();

      // Basic Member Match
      const match: any = {
        chapter: new ObjectId(chapterId),
        isDelete: 0,
        isActive: 1
      };

      if (search) {
        match.fullName = { $regex: search, $options: "i" };
      }

      const pipeline: any[] = [
        { $match: match },

        // 1. Business Category Lookup
        {
          $lookup: {
            from: "businesscategories",
            localField: "businessCategory",
            foreignField: "_id",
            as: "category"
          }
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

        // 2. Count 121s (OneToOneMeeting)
        // Initiated By Member
        {
          $lookup: {
            from: "one_to_one_meetings",
            let: { mId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$initiatedById", "$$mId"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "oneToOne"
          }
        },

        // 3. Count Referrals (Referral)
        // From Member
        {
          $lookup: {
            from: "referrals",
            let: { mId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$fromMemberId", "$$mId"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "referrals"
          }
        },

        // 4. Count Visitors (Visitor)
        // Created By Member
        {
          $lookup: {
            from: "visitors",
            let: { mId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$createdBy", "$$mId"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "visitors"
          }
        },

        // 5. Count Chief Guests (MobileChiefGuest)
        // Created By Member
        {
          $lookup: {
            from: "mobile_chief_guest",
            let: { mId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$createdBy", "$$mId"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "chiefGuests"
          }
        },

        // 6. Thank You Slip Value (ThankYouSlip)
        // Given By Member
        {
          $lookup: {
            from: "thank_you_slips",
            let: { mId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$createdBy", "$$mId"] },
                  isDelete: 0
                }
              },
              { $group: { _id: null, total: { $sum: "$amount" } } }
            ],
            as: "thankYouSlips"
          }
        },

        // 7. Power Dates (PowerDate)
        // Created By Member
        {
          $lookup: {
            from: "power_date",
            let: { mId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$createdBy", "$$mId"] },
                  isDelete: 0
                }
              },
              { $count: "count" }
            ],
            as: "powerDates"
          }
        },

        // 8. Trainings (Attendance)
        // Member Present
        {
          $lookup: {
            from: "attendance",
            let: { mId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$memberId", "$$mId"] },
                      { $eq: ["$sourceType", "TRAINING"] },
                      // { $eq: ["$status", "present"] }, // Optional: Add if strictly 'present'
                      { $eq: ["$isDelete", 0] }
                    ]
                  }
                }
              },
              { $count: "count" }
            ],
            as: "trainings"
          }
        },

        // Projection
        {
          $project: {
            _id: 1,
            memberName: "$fullName",
            category: "$category.name",
            oneToOneCount: { $ifNull: [{ $arrayElemAt: ["$oneToOne.count", 0] }, 0] },
            referralCount: { $ifNull: [{ $arrayElemAt: ["$referrals.count", 0] }, 0] },
            visitorCount: { $ifNull: [{ $arrayElemAt: ["$visitors.count", 0] }, 0] },
            chiefGuestCount: { $ifNull: [{ $arrayElemAt: ["$chiefGuests.count", 0] }, 0] },
            thankYouSlipValue: { $ifNull: [{ $arrayElemAt: ["$thankYouSlips.total", 0] }, 0] },
            powerDateCount: { $ifNull: [{ $arrayElemAt: ["$powerDates.count", 0] }, 0] },
            trainingCount: { $ifNull: [{ $arrayElemAt: ["$trainings.count", 0] }, 0] },
          }
        },

        // Facet Pagination
        {
          $facet: {
            data: [
              { $sort: { memberName: 1 } },
              { $skip: page * limit },
              { $limit: limit }
            ],
            meta: [{ $count: "total" }]
          }
        }
      ];

      const result = await this.memberRepo.aggregate(pipeline).toArray();
      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (error) {
      console.log(error);
      return response(res, 500, "Failed to fetch chapter member report");
    }
  }

  @Get("/member-points-report")
  async getMemberPointsDynamic(
    @QueryParams() query: any,
    @Res() res: Response,
    @Req() req: RequestWithUser,

  ) {
    try {
            const search = req.query.search?.toString();

      const pipeline: any[] = [
        {
          $group: {
            _id: {
              userId: "$userId",
              pointKey: "$pointKey"
            },
            total: { $sum: "$value" }
          }
        },
        {
          $group: {
            _id: "$_id.userId",
            totalPoints: { $sum: "$total" },
            kv: {
              $push: {
                k: "$_id.pointKey",
                v: "$total"
              }
            }
          }
        },
        {
          $addFields: {
            points: { $arrayToObject: "$kv" }
          }
        },
        {
          $lookup: {
            from: "member",
            let: { memberId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$memberId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: 1,
                  profileImage: 1,
                  email: 1,
                  phoneNumber: 1,
                  chapter: 1
                }
              }
            ],
            as: "member"
          }
        },
        { $unwind: { path: "$member"} },
        {
          $lookup: {
            from: "chapters",
            localField: "member.chapter",
            foreignField: "_id",
            as: "chapter"
          }
        },
        { $unwind: { path: "$chapter", preserveNullAndEmptyArrays: true } },

        ...(query.chapterId && ObjectId.isValid(query.chapterId)
          ? [{ $match: { "chapter._id": new ObjectId(query.chapterId) } }]
          : []),

        ...(query.zoneId && ObjectId.isValid(query.zoneId)
          ? [{ $match: { "chapter.zoneId": new ObjectId(query.zoneId) } }]
          : []),

        ...(query.edId && ObjectId.isValid(query.edId)
          ? [{ $match: { "chapter.edId": new ObjectId(query.edId) } }]
          : []),

        ...(query.rdId && ObjectId.isValid(query.rdId)
          ? [{ $match: { "chapter.rdId": new ObjectId(query.rdId) } }]
          : []),
        {
          $project: {
            _id: 0,
            memberId: "$_id",
            name: "$member.fullName",
            profileImage: "$member.profileImage",
            email: "$member.email",
            phoneNumber: "$member.phoneNumber",
            totalPoints: 1,
            points: 1
          }
        },
        ...(search ? [{
          $match: {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { phoneNumber: { $regex: search, $options: "i" } }

            ]
          }
        }] : []),
        { $sort: { totalPoints: -1 } }

      ];

      const data =
        await AppDataSource
          .getMongoRepository(UserPoints)
          .aggregate(pipeline)
          .toArray();

      return response(res, 200, "Member points fetched", data);

    } catch (error) {
      console.error(error);
      return response(res, 500, "Failed to fetch member points");
    }
  }
  @Get("/thank-you-slips-reports")
  async getThankYouSlipReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 10);
      const search = query.search?.trim();

      const regionId = query.regionId;
      const zoneId = query.zoneId;
      const edId = query.edId;
      const rdId = query.rdId;
      const chapterId = query.chapterId;

      const pipeline: any[] = [

        {
          $match: {
            isDelete: 0,
            isActive: 1
          }
        },

        {
          $lookup: {
            from: "member",
            let: { giverId: "$createdBy" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$giverId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: 1,
                  chapter: 1
                }
              }
            ],
            as: "giver"
          }
        },
        { $unwind: "$giver" },

        {
          $lookup: {
            from: "member",
            let: { receiverId: "$thankTo" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$receiverId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: 1
                }
              }
            ],
            as: "receiver"
          }
        },
        { $unwind: "$receiver" },

        {
          $lookup: {
            from: "chapters",
            let: { chapterId: "$giver.chapter" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$chapterId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  chapterName: 1,
                  regionId: 1,
                  zoneId: 1,
                  edId: 1,
                  rdId: 1
                }
              }
            ],
            as: "chapter"
          }
        },
        { $unwind: "$chapter" },

        ...(chapterId && ObjectId.isValid(chapterId)
          ? [{ $match: { "chapter._id": new ObjectId(chapterId) } }]
          : []),

        ...(regionId && ObjectId.isValid(regionId)
          ? [{ $match: { "chapter.regionId": new ObjectId(regionId) } }]
          : []),

        ...(zoneId && ObjectId.isValid(zoneId)
          ? [{ $match: { "chapter.zoneId": new ObjectId(zoneId) } }]
          : []),

        ...(edId && ObjectId.isValid(edId)
          ? [{ $match: { "chapter.edId": new ObjectId(edId) } }]
          : []),

        ...(rdId && ObjectId.isValid(rdId)
          ? [{ $match: { "chapter.rdId": new ObjectId(rdId) } }]
          : []),

        ...(search
          ? [{
            $match: {
              $or: [
                // Member Name
                { "giver.fullName": { $regex: search, $options: "i" } },

                // Thank To Name
                { "receiver.fullName": { $regex: search, $options: "i" } },

                // Business Type
                { businessType: { $regex: search, $options: "i" } },

                // Referral Type
                { referralType: { $regex: search, $options: "i" } },

                // Amount (number -> convert to string match)
                {
                  $expr: {
                    $regexMatch: {
                      input: { $toString: "$amount" },
                      regex: search,
                      options: "i"
                    }
                  }
                },

                { comments: { $regex: search, $options: "i" } }
              ]
            }
          }]
          : []),


        { $sort: { createdAt: -1 } },

        {
          $project: {
            _id: 0,
            date: "$createdAt",
            memberName: "$giver.fullName",
            thankTo: "$receiver.fullName",
            businessType: 1,
            referralType: 1,
            amount: 1,
            comments: 1,
            starRating: "$ratings",
            chapterName: "$chapter.chapterName"
          }
        },

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

      const result =
        await AppDataSource
          .getMongoRepository(ThankYouSlip)
          .aggregate(pipeline)
          .toArray();

      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

      return pagination(total, data, limit, page, res);

    } catch (error) {
      console.error(error);
      return response(res, 500, "Failed to fetch Thank You Slip report");
    }
  }

  @Get("/performance-report")
  async getPerformanceReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {
      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 10, 1);
      const search = query.search?.toString();

      const chapterId = query.chapterId;
      const zoneId = query.zoneId;
      const regionId = query.regionId;
      const edId = query.edId;
      const rdId = query.rdId;

      const formType = query.formType?.toString(); // 121, referal, thankyouslip, visito, traing, meeting, cheif guest, powrDate
      const period = query.period?.toString(); // current_month, tenure_1, tenure_2, one_year, overall

      // --- 1. Date Filter Logic ---
      const now = new Date();
      const currentYear = now.getFullYear();
      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (period && period !== "overall") {
        if (period === "current_month") {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (period === "tenure_1") {
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 5, 30, 23, 59, 59, 999);
        } else if (period === "tenure_2") {
          startDate = new Date(currentYear, 6, 1);
          endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        } else if (period === "one_year") {
          startDate = new Date(currentYear, 0, 1);
          endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        }
      }

      // --- 2. Activity Lookup Logic ---
      // We start with Member collection
      const pipeline: any[] = [
        { $match: { isDelete: 0, isActive: 1 } }, // Active Members

        // Lookup Details (Chapter, Zone, Category)
        {
          $lookup: {
            from: "chapters",
            localField: "chapter",
            foreignField: "_id",
            as: "chapterDetails"
          }
        },
        { $unwind: { path: "$chapterDetails", preserveNullAndEmptyArrays: true } },

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
          $lookup: {
            from: "businesscategories",
            localField: "businessCategory",
            foreignField: "_id",
            as: "categoryDetails"
          }
        },
        { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },

        // Hierarchy Filters
        ...(chapterId ? [{ $match: { "chapterDetails._id": new ObjectId(chapterId) } }] : []),
        ...(zoneId ? [{ $match: { "chapterDetails.zoneId": new ObjectId(zoneId) } }] : []),
        ...(regionId ? [{ $match: { "chapterDetails.regionId": new ObjectId(regionId) } }] : []),
        ...(edId ? [{ $match: { "chapterDetails.edId": new ObjectId(edId) } }] : []),
        ...(rdId ? [{ $match: { "chapterDetails.rdId": new ObjectId(rdId) } }] : []),

        // Search Filter
        ...(search ? [{
          $match: {
            $or: [
              { fullName: { $regex: search, $options: "i" } },
              { phoneNumber: { $regex: search, $options: "i" } },
              { "chapterDetails.chapterName": { $regex: search, $options: "i" } }
            ]
          }
        }] : [])
      ];

      // Add Count Lookup based on formType
      let countPipeline: any[] = [];
      let collectionName = "";
      let foreignField = ""; // field in activity collection that matches member _id
      let dateField = "createdAt"; // default date field
      let extraMatch: any = { isDelete: 0 }; // extra conditions

      // Normalize formType
      const type = formType?.toLowerCase();

      // IMPORTANT: Adjust collection names to match exact MongoDB collection names
      if (type === "one_to_one") {
        collectionName = "one_to_one_meetings";
        foreignField = "initiatedById";
        // meetingDateTime is usually better for reports, but if period filters 'performance', createdAt is often used for 'when logged'. 
        // However, typically reports want 'meeting done in this period'. Let's stick to createdAt for consistency unless 'meetingDateTime' specified. 
        // Re-reading user request: dates for filtering are 'current_month' etc. Usually applies to Creation or Event date. Let's use createdAt for simplicity across board unless crucial.
      } else if (type === "referral") {
        collectionName = "referrals";
        foreignField = "fromMemberId";
      } else if (type === "thank_you_slip") {
        collectionName = "thank_you_slips";
        foreignField = "createdBy";
      } else if (type === "visitor") {
        collectionName = "visitors";
        foreignField = "createdBy";
        dateField = "visitorDate"; // specific date often used
      } else if (type === "meeting") {
        collectionName = "attendance";
        foreignField = "memberId";
        extraMatch = { sourceType: "MEETING", status: "present", isDelete: 0 };
      } else if (type === "training") {
        collectionName = "attendance";
        foreignField = "memberId";
        extraMatch = { sourceType: "TRAINING", status: "present", isDelete: 0 };
      } else if (type === "chief_guest") {
        collectionName = "mobile_chief_guest";
        foreignField = "createdBy";
      } else if (type === "power_date") {
        collectionName = "power_date";
        foreignField = "createdBy";
      }

      if (collectionName) {
        const lookupMatch: any = { ...extraMatch };

        if (startDate && endDate) {
          lookupMatch[dateField] = { $gte: startDate, $lte: endDate };
        }

        lookupMatch["$expr"] = { $eq: ["$" + foreignField, "$$memberId"] };

        // Removing $expr from match object to separate purely constant matches from internal variable matches if needed,
        // but $lookup pipeline allows $expr referring to let variables.
        // Correct format:

        pipeline.push({
          $lookup: {
            from: collectionName,
            let: { memberId: "$_id" },
            pipeline: [
              { $match: lookupMatch }
            ],
            as: "activities"
          }
        });

        pipeline.push({
          $addFields: {
            count: { $size: "$activities" }
          }
        });
      } else {
        // If no recognized formType, count is 0
        pipeline.push({ $addFields: { count: 0 } });
      }

      // Filter: Only include members with activity > 0 (Top Performers)
      pipeline.push({
        $match: { count: { $gt: 0 } }
      });

      // Final Projection and Pagination
      pipeline.push(
        {
          $project: {
            _id: 1,
            name: "$fullName",
            number: "$phoneNumber",
            zone: "$zoneDetails.name",
            chapterName: "$chapterDetails.chapterName",
            category: "$categoryDetails.name",
            count: 1
          }
        },
        { $sort: { count: -1 } }, // Default sort by count descending?
        {
          $facet: {
            data: [
              { $skip: page * limit },
              { $limit: limit }
            ],
            meta: [{ $count: "total" }]
          }
        }
      );

      const result = await this.memberRepo.aggregate(pipeline).toArray();

      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (error) {
      console.error(error);
      return response(res, 500, "Failed to fetch performance report");
    }
  }

  @Get("/reports/testimonials")
  async testimonialReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 10, 1);

      const { chapterId, zoneId, edId, rdId, search } = query;

      const pipeline: any[] = [

        // ✅ only valid testimonials
        {
          $match: {
            isDelete: 0,
            isActive: 1,
            ratings: { $exists: true, $nin: [null, ""] }
          }
        },

        // 👉 From Member (giver)
        {
          $lookup: {
            from: "member",
            let: { memberId: "$createdBy" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$memberId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: 1,
                  chapter: 1
                }
              }
            ],
            as: "fromMember"
          }
        },
        { $unwind: { path: "$fromMember", preserveNullAndEmptyArrays: true } },
        // 👉 To Member (receiver)
        {
          $lookup: {
            from: "member",
            let: { memberId: "$thankTo" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$memberId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: 1
                }
              }
            ],
            as: "toMember"
          }
        },
        { $unwind: { path: "$toMember", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "chapters",
            let: { chapterId: "$fromMember.chapter" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$chapterId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  zoneId: 1,
                  edId: 1,
                  rdId: 1
                }
              }
            ],
            as: "chapter"
          }
        },
        { $unwind: { path: "$chapter", preserveNullAndEmptyArrays: true } },

        // 👉 Zone
        {
          $lookup: {
            from: "zones",
            let: { zoneId: "$chapter.zoneId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$zoneId"] }
                }
              },
              { $project: { _id: 1 } }
            ],
            as: "zone"
          }
        },
        { $unwind: "$zone" },

        // 👉 ED
        {
          $lookup: {
            from: "member",
            let: { edId: "$chapter.edId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$edId"] }
                }
              },
              { $project: { _id: 1 } }
            ],
            as: "ed"
          }
        },
        { $unwind: "$ed" },

        // 👉 RD
        {
          $lookup: {
            from: "member",
            let: { rdId: "$chapter.rdId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$rdId"] }
                }
              },
              { $project: { _id: 1 } }
            ],
            as: "rd"
          }
        },
        { $unwind: "$rd" },
        {
          $addFields: {
            fromMemberName: "$fromMember.fullName",
            toMemberName: "$toMember.fullName"
          }
        },


        // 🎯 FILTERS
        ...(chapterId ? [{ $match: { "chapter._id": new ObjectId(chapterId) } }] : []),
        ...(zoneId ? [{ $match: { "zone._id": new ObjectId(zoneId) } }] : []),
        ...(edId ? [{ $match: { "ed._id": new ObjectId(edId) } }] : []),
        ...(rdId ? [{ $match: { "rd._id": new ObjectId(rdId) } }] : []),

        ...(search ? [{
          $match: {
            $or: [

              // Created By
              { fromMemberName: { $regex: search, $options: "i" } },

              { toMemberName: { $regex: search, $options: "i" } },

              { comments: { $regex: search, $options: "i" } },

              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: "$ratings" },
                    regex: search,
                    options: "i"
                  }
                }
              }
            ]
          }
        }] : []),
        { $sort: { createdAt: -1 } },
        {
          $facet: {

            data: [
              { $skip: page * limit },
              { $limit: limit },
              {
                $project: {
                  _id: 0,
                  date: "$createdAt",
                  memberName: "$fromMember.fullName",
                  testimonialTo: "$toMember.fullName",
                  comments: "$comments",
                  rating: "$ratings"
                }
              }
            ],

            meta: [
              { $count: "total" }
            ]
          }
        }

      ];

      const result =
        await this.thankYouRepo.aggregate(pipeline).toArray();

      const data = result[0]?.data || [];
      const total = result[0]?.meta[0]?.total || 0;

      return pagination(total, data, limit, page, res);

    } catch (err) {
      console.error(err);
      return response(res, 500, "Failed to fetch testimonials report");
    }
  }
  @Get("/renewal-report")
  async renewalReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 10, 1);

      const search = query.search?.toString();
      const statusFilter = query.status;

      const today = new Date();
      const dueSoonDate = new Date();
      dueSoonDate.setDate(today.getDate() + 30);

      const match: any = { isDelete: 0 };

      if (search) {
        match.$or = [
          { fullName: { $regex: search, $options: "i" } },
          { membershipId: { $regex: search, $options: "i" } }
        ];
      }

      const pipeline: any[] = [

        { $match: match },
        {
          $addFields: {
            status: {
              $cond: [
                { $lt: ["$renewalDate", today] },
                "Expired",
                {
                  $cond: [
                    { $lte: ["$renewalDate", dueSoonDate] },
                    "Due Soon",
                    "Active"
                  ]
                }
              ]
            }
          }
        },
        {
          $match: {
            status: statusFilter
              ? statusFilter === "expired"
                ? "Expired"
                : "Due Soon"
              : { $in: ["Expired", "Due Soon"] }
          }
        },
        {
          $lookup: {
            from: "regions",
            let: { regionId: "$region" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$regionId"] }
                }
              },
              {
                $project: {
                  _id: 0,
                  region: 1
                }
              }
            ],
            as: "region"
          }
        },
        { $unwind: { path: "$region", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "chapters",
            let: { chapterId: "$chapter" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$chapterId"] }
                }
              },
            ],
            as: "chapter"
          }
        },
        { $unwind: { path: "$chapter", preserveNullAndEmptyArrays: true } },
        ...(query.chapterId && ObjectId.isValid(query.chapterId)
          ? [{ $match: { "chapter._id": new ObjectId(query.chapterId) } }]
          : []),

        ...(query.zoneId && ObjectId.isValid(query.zoneId)
          ? [{ $match: { "chapter.zoneId": new ObjectId(query.zoneId) } }]
          : []),

        ...(query.edId && ObjectId.isValid(query.edId)
          ? [{ $match: { "chapter.edId": new ObjectId(query.edId) } }]
          : []),

        ...(query.rdId && ObjectId.isValid(query.rdId)
          ? [{ $match: { "chapter.rdId": new ObjectId(query.rdId) } }]
          : []),

        {
          $project: {
            memberId: "$membershipId",
            memberName: "$fullName",
            chapter: "$chapter.chapterName",
            region: "$region.region",
            membershipId: "$membershipId",
            status: 1
          }
        },

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

      const [result] =
        await this.memberRepo.aggregate(pipeline).toArray();

      const data = result?.data || [];
      const total = result?.meta?.[0]?.total || 0;

      return res.status(200).json({
        success: true,
        total,
        page,
        limit,
        data
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
  @Get("/testimonials-report")
  async getTestimonialsReport(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {

      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Number(query.limit ?? 10);

      const search = query.search?.toString();
      const zoneId = query.zoneId;
      const edId = query.edId;
      const rdId = query.rdId;
      const chapterId = query.chapterId;

      const match: any = {
        isDelete: 0,
        isActive: 1
      };

      const pipeline: any[] = [
        { $match: match },

        {
          $lookup: {
            from: "member",
            let: { fromId: "$createdBy" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$fromId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: 1,
                  companyName: 1,
                  zone: 1,
                  ed: 1,
                  rd: 1,
                  chapter: 1
                }
              }
            ],
            as: "fromMember"
          }
        },
        { $unwind: "$fromMember" },

        {
          $lookup: {
            from: "member",
            let: { toId: "$thankTo" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$toId"] }
                }
              },
              {
                $project: {
                  _id: 1,
                  fullName: 1
                }
              }
            ],
            as: "toMember"
          }
        },
        { $unwind: "$toMember" }
      ];

      if (search) {
        pipeline.push({
          $match: {
            "fromMember.fullName": {
              $regex: search,
              $options: "i"
            }
          }
        });
      }

      if (zoneId) {
        pipeline.push({
          $match: {
            "fromMember.zone": new ObjectId(zoneId)
          }
        });
      }

      if (edId) {
        pipeline.push({
          $match: {
            "fromMember.ed": new ObjectId(edId)
          }
        });
      }

      if (rdId) {
        pipeline.push({
          $match: {
            "fromMember.rd": new ObjectId(rdId)
          }
        });
      }

      if (chapterId) {
        pipeline.push({
          $match: {
            "fromMember.chapter": new ObjectId(chapterId)
          }
        });
      }

      pipeline.push(
        {
          $project: {
            _id: 1,
            date: "$createdAt",
            memberName: "$fromMember.fullName",
            testimonialTo: "$toMember.fullName",
            comments: "$comments",
            rating: "$ratings"
          }
        },
        { $sort: { date: -1 } }
      );

      if (limit > 0) {
        pipeline.push({
          $facet: {
            data: [
              { $skip: page * limit },
              { $limit: limit }
            ],
            meta: [{ $count: "total" }]
          }
        });
      } else {
        pipeline.push({
          $facet: {
            data: [{ $skip: 0 }],
            meta: [{ $count: "total" }]
          }
        });
      }

      const [result] =
        await this.thankYouRepo.aggregate(pipeline).toArray();

      const data = result?.data || [];
      const total = result?.meta?.[0]?.total || 0;

      return response(
        res,
        200,
        "Testimonials report fetched successfully",
        {
          total,
          page,
          limit: limit === 0 ? total : limit,
          data
        }
      );

    } catch (error) {
      console.error(error);
      return response(res, 500, "Failed to fetch testimonials report");
    }
  }

}
