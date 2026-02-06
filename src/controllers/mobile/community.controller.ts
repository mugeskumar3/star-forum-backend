import {
  JsonController,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseBefore,
  QueryParam,
  Param,
} from "routing-controllers";
import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import { Community } from "../../entity/Community";
import { Member } from "../../entity/Member";
import { Chapter } from "../../entity/Chapter";
import { Region } from "../../entity/Region";
import { BusinessCategory } from "../../entity/BusinessCategory";
import { CreateCommunityDto } from "../../dto/mobile/Community.dto";
import { Points } from "../../entity/Points";
import { UserPoints } from "../../entity/UserPoints";
import { UserPointHistory } from "../../entity/UserPointHistory";
import { NotificationService } from "../../services/notification.service";
interface RequestWithUser extends Request {
  user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/community")
export class MobileCommunityController {
  private communityRepository = AppDataSource.getMongoRepository(Community);
  private memberRepository = AppDataSource.getMongoRepository(Member);
  private chapterRepository = AppDataSource.getMongoRepository(Chapter);
  private regionRepository = AppDataSource.getMongoRepository(Region);
  private categoryRepository = AppDataSource.getMongoRepository(BusinessCategory);
  private pointsRepo = AppDataSource.getMongoRepository(Points);
  private userPointsRepo = AppDataSource.getMongoRepository(UserPoints);
  private historyRepo = AppDataSource.getMongoRepository(UserPointHistory);
  private readonly notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService(); // ✅ FIXED
  }
  @Post("/")
  async createCommunity(
    @Body() body: CreateCommunityDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      console.log(body,'body');
      
      const userId = new ObjectId(req.user.userId);

      const community = new Community();
      community.title = body.title;
      community.details = body.details;
      community.location = body?.location ?? "";
      community.type = body.type;
      community.createdBy = userId;
      community.createdAt = new Date();
      community.updatedAt = new Date();
      community.isActive = 1;
      community.isDelete = 0;
      community.category = body.category?.length ? community.category = body.category.map(p => new ObjectId(p as any)) : []
      const communityResult = await this.communityRepository.save(community);
      const pointKey = body.type;

      const pointConfig = await this.pointsRepo.findOne({
        where: {
          key: pointKey,
          isActive: 1,
          isDelete: 0
        }
      });

      // If admin forgot to configure points → still succeed
      if (!pointConfig) {
        return response(
          res,
          StatusCodes.BAD_REQUEST,
          "Community post created (points not configured)",
          community
        );
      }

      /* ---------------- UPDATE USER POINTS ---------------- */

      await this.userPointsRepo.updateOne(
        { userId, pointKey },
        { $inc: { value: pointConfig.value } },
        { upsert: true }
      );

      await this.historyRepo.insertOne({
        userId,
        pointKey,
        change: pointConfig.value,
        source: "COMMUNITY",
        sourceId: community.id,
        remarks: `Community ${body.type.toUpperCase()} post created`,
        createdAt: new Date()
      });
      await this.notificationService.createNotificationCommunity({
        moduleName: "Community",
        moduleId: communityResult.id,
        createdBy: req.user.userId,
        subject: "Community Post Created",
        content: `A new community post has been created. Tap to view the details.`,
        categoryId:  body.category.map(p => new ObjectId(p as any))// Assuming first category for notification   
      });


      return response(
        res,
        StatusCodes.CREATED,
        "Community post created successfully",
        community,
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/")
  async listCommunity(
    @QueryParam("type") type: string,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const userId = new ObjectId(req.user.userId);
      let data = [];

      if (type === "myself") {
        data = await this.communityRepository.find({
          where: {
            createdBy: userId,
            isDelete: 0
          },
          order: { createdAt: "DESC" } as any
        });
      } else if (type === "others") {
        const currentUser = await this.memberRepository.findOneBy({ _id: userId });

        if (!currentUser) {
          return response(res, StatusCodes.NOT_FOUND, "User not found");
        }

        if (!currentUser.chapter) {
          return response(res, StatusCodes.OK, "Community posts fetched successfully", []);
        }

        const pipeline = [
          {
            $match: {
              isDelete: 0,
              createdBy: { $ne: userId }
            }
          },
          {
            $lookup: {
              from: "member",
              localField: "createdBy",
              foreignField: "_id",
              as: "creator"
            }
          },
          { $unwind: "$creator" },

          // Same chapter filter
          // {
          //   $match: {
          //     "creator.chapter": currentUser.chapter
          //   }
          // },

          {
            $match: {
              $expr: {
                $cond: {
                  if: { $eq: ["$type", "requirement"] },
                  then: {
                    $gt: [
                      {
                        $size: {
                          $setIntersection: [
                            {
                              $cond: {
                                if: { $isArray: "$category" },
                                then: "$category",
                                else: ["$category"] // wrap single ObjectId
                              }
                            },
                            [new ObjectId(currentUser.businessCategory)]
                          ]
                        }
                      },
                      0
                    ]
                  },
                  else: true
                }
              }
            }
          },


          { $sort: { createdAt: -1 } },

          {
            $project: {
              title: 1,
              details: 1,
              category: 1,
              location: 1,
              type: 1,
              createdBy: 1,
              createdAt: 1,
              updatedAt: 1,
              creator: {
                fullName: "$creator.fullName",
                profileImage: "$creator.profileImage",
                companyName: "$creator.companyName",
                position: "$creator.position"
              }
            }
          }
        ];

        data = await this.communityRepository.aggregate(pipeline).toArray();

      } else {
        return response(res, StatusCodes.BAD_REQUEST, "Invalid type param. Use 'myself' or 'others'");
      }

      return response(res, StatusCodes.OK, "Community posts fetched successfully", data);

    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Post("/respond")
  async respondCommunity(
    @Body() body: { communityId: string; type: string },
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const userId = new ObjectId(req.user.userId);
      const communityId = new ObjectId(body.communityId);
      const community = await this.communityRepository.findOne({
        where: { _id: communityId, isDelete: 0 },
      });
      if (!community) {
        return response(res, StatusCodes.NOT_FOUND, "Community not found", []);
      }
      if (!community.responses) {
        community.responses = [];
      }
      const exists = community.responses.some(
        (r) => r.userId.toString() === userId.toString(),
      );
      if (exists) {
        return response(
          res,
          StatusCodes.BAD_REQUEST,
          "Already responded to this community",
          [],
        );
      }
      community.responses.push({
        userId,
        type: body.type,
        respondedAt: new Date(),
      });
      community.updatedAt = new Date();
      await this.communityRepository.save(community);
      return response(
        res,
        StatusCodes.OK,
        "Response saved successfully",
        community.responses,
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/responses/full-details/:id")
  async getCommunityResponsesFull(
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    try {
      const communityId = new ObjectId(id);

      const community = await this.communityRepository.findOne({
        where: { _id: communityId, isDelete: 0 },
      });

      if (!community || !community.responses?.length) {
        return response(res, StatusCodes.OK, "No responses", []);
      }

      // Extract userIds from responses
      const userIds = community.responses.map((r) => r.userId);

      // Fetch members
      const members = await this.memberRepository.find({
        where: { _id: { $in: userIds }, isDelete: 0 },
      });

      if (!members.length) {
        return response(res, StatusCodes.OK, "No members found", []);
      }

      const chapterIds = members.map((m) => m.chapter).filter(Boolean);

      const categoryIds = members
        .map((m) => m.businessCategory)
        .filter(Boolean);

      // Fetch chapters
      const chapters = await this.chapterRepository.find({
        where: { _id: { $in: chapterIds }, isDelete: 0 },
      });

      const regionIds = chapters.map((c) => c.regionId).filter(Boolean);

      // Fetch regions
      const regions = await this.regionRepository.find({
        where: { _id: { $in: regionIds }, isDelete: 0 },
      });

      // Fetch categories
      const categories = await this.categoryRepository.find({
        where: { _id: { $in: categoryIds }, isDelete: 0 },
      });

      // Build lookup maps (Mongo safe)
      const chapterMap = new Map(
        chapters.map((c) => [c.id.toString(), c.chapterName]),
      );

      const regionMap = new Map(regions.map((r) => [r.id.toString(), r.region]));

      const categoryMap = new Map(
        categories.map((c) => [c.id.toString(), c.name]),
      );

      const memberMap = new Map(members.map((m) => [m.id.toString(), m]));
      // Final formatted response
      const result = community.responses.map((r) => {
        const member = memberMap.get(r.userId.toString());

        const chapterId = member?.chapter?.toString();

        const chapter = chapterMap.get(chapterId || "");

        const regionId = chapters.find(
          (c) => c.id.toString() === chapterId,
        )?.regionId;

        const region = regionMap.get(regionId?.toString() || "");

        return {
          userId: r.userId,
          fullName: member?.fullName || "",
          profileImage: member?.profileImage?.path || "",
          chapter: chapter || "",
          region: region || "",
          businessCategory:
            categoryMap.get(member?.businessCategory?.toString() || "") || "",
          type: r.type,
          respondedAt: r.respondedAt,
        };
      });

      return response(res, StatusCodes.OK, "Fetched successfully", result);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
}
