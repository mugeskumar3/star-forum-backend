import {
  JsonController,
  Get,
  Res,
  QueryParams,
  UseBefore
} from "routing-controllers";
import { Response } from "express";
import { AppDataSource } from "../../data-source";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";
import pagination from "../../utils/pagination";
import response from "../../utils/response";
import { StatusCodes } from "http-status-codes";
import { ObjectId } from "mongodb";

import { OneToOneMeeting } from "../../entity/121's";
import { Referral } from "../../entity/Referral";

@UseBefore(AuthMiddleware)
@JsonController("/reports")
export class ReportController {

  private oneToOneRepo =
    AppDataSource.getMongoRepository(OneToOneMeeting);

  private referralRepo =
    AppDataSource.getMongoRepository(Referral);
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
            telephone:1,
            email:1,
            address:1,
            toldWouldCall:1,
            givenCard:1,
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
}
