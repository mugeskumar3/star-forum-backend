import {
  JsonController,
  Post,
  Get,
  Req,
  Res,
  UseBefore,
  QueryParams,
  Body
} from "routing-controllers";
import { Response } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { Referral } from "../../entity/Referral";
import { Points } from "../../entity/Points";
import { UserPoints } from "../../entity/UserPoints";
import { UserPointHistory } from "../../entity/UserPointHistory";

import { AuthMiddleware } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import { CreateReferralDto } from "../../dto/mobile/Referral.dto";

@UseBefore(AuthMiddleware)
@JsonController("/referrals")
export class ReferralController {
  private referralRepo =
    AppDataSource.getMongoRepository(Referral);

  private pointsRepo =
    AppDataSource.getMongoRepository(Points);

  private userPointsRepo =
    AppDataSource.getMongoRepository(UserPoints);

  private historyRepo =
    AppDataSource.getMongoRepository(UserPointHistory);

  @Post("/")
  async createReferral(
    @Req() req: any,
    @Body() body: CreateReferralDto,
    @Res() res: Response
  ) {
    try {
      const userId = new ObjectId(req.user.userId);

      const referral = this.referralRepo.create({
        ...body,
        status: body.status || "Completed",
        chapterId: body.chapterId
          ? new ObjectId(body.chapterId)
          : undefined,
        toMemberId: new ObjectId(body.toMemberId),
        fromMemberId: userId,
        rating: Number(body.rating),
        isDelete: 0
      });

      await this.referralRepo.save(referral);

      const referralPoint = await this.pointsRepo.findOne({
        where: {
          key: "referrals",
          isActive: 1,
          isDelete: 0
        }
      });
      if (!referralPoint) {
        return response(
          res,
          StatusCodes.CREATED,
          "Referral submitted (points not configured)",
          referral
        );
      }

      await this.userPointsRepo.updateOne(
        {
          userId,
          pointKey: "referrals"
        },
        {
          $inc: { value: referralPoint.value }
        },
        { upsert: true }
      );

      await this.historyRepo.insertOne({
        userId,
        pointKey: "referrals",
        change: referralPoint.value,
        source: "REFERRAL",
        sourceId: referral.id,
        remarks: "Referral submitted"
      });

      return response(
        res,
        StatusCodes.CREATED,
        "Referral submitted successfully",
        referral
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/given")
  async getGivenReferrals(
    @Req() req: any,
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {
      const memberId = new ObjectId(req.user.userId);

      const referrals = await this.referralRepo.aggregate([
        {
          $match: {
            fromMemberId: memberId,
            isDelete: 0
          }
        },
        {
          $lookup: {
            from: "member",
            let: { memberId: "$fromMemberId" },
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
                  email: 1,
                  mobile: 1,
                  profileImage: 1
                }
              }
            ],
            as: "fromMember"
          }
        },
        {
          $unwind: {
            path: "$fromMember",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "member",
            let: { memberId: "$toMemberId" },
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
                  email: 1,
                  mobile: 1,
                  profileImage: 1
                }
              }
            ],
            as: "toMember"
          }
        },
        {
          $unwind: {
            path: "$toMember",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $project: {
            referralFor: 1,
            referralType: 1,
            referralName: 1,
            telephone: 1,
            email: 1,
            address: 1,
            rating: 1,
            comments: 1,
            status: 1,
            createdAt: 1,
            fromMember: 1,
            toMember: 1
          }
        }
      ]).toArray();

      return response(
        res,
        StatusCodes.OK,
        "Given referrals fetched",
        referrals
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

 @Get("/received")
async getReceivedReferrals(
  @Req() req: any,
  @QueryParams() query: any,
  @Res() res: Response
) {
  try {
    const memberId = new ObjectId(req.user.userId);

    const referrals = await this.referralRepo.aggregate([
      {
        $match: {
          toMemberId: memberId,
          isDelete: 0
        }
      },
      {
        $lookup: {
          from: "member",
          let: { memberId: "$fromMemberId" },
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
                email: 1,
                mobile: 1,
                profileImage: 1
              }
            }
          ],
          as: "fromMember"
        }
      },
      {
        $unwind: {
          path: "$fromMember",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "member",
          let: { memberId: "$toMemberId" },
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
                email: 1,
                mobile: 1,
                profileImage: 1
              }
            }
          ],
          as: "toMember"
        }
      },
      {
        $unwind: {
          path: "$toMember",
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $sort: { createdAt: -1 }
      },

      {
        $project: {
          referralFor: 1,
          referralType: 1,
          referralName: 1,
          telephone: 1,
          email: 1,
          address: 1,
          rating: 1,
          comments: 1,
          status: 1,
          createdAt: 1,
          fromMember: 1,
          toMember: 1
        }
      }
    ]).toArray();

    return response(
      res,
      StatusCodes.OK,
      "Received referrals fetched",
      referrals
    );
  } catch (error) {
    return handleErrorResponse(error, res);
  }
}

}
