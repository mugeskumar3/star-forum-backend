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
      const referrals = await this.referralRepo.find({
        where: {
          fromMemberId: new ObjectId(req.user.userId),
          isDelete: 0
        },
        order: { createdAt: "DESC" }
      });

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
    @Res() res: Response
  ) {
    try {
      const referrals = await this.referralRepo.find({
        where: {
          toMemberId: new ObjectId(req.user.userId),
          isDelete: 0
        },
        order: { createdAt: "DESC" }
      });

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
