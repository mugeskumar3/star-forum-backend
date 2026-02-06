import {
  JsonController,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Res,
  QueryParams,
  Req,
  UseBefore,
} from "routing-controllers";

import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";

import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { StarUpdate } from "../../entity/StarUpdate";
import { Community } from "../../entity/Community";
import { Member } from "../../entity/Member";
import { Chapter } from "../../entity/Chapter";
import { Region } from "../../entity/Region";
import { BusinessCategory } from "../../entity/BusinessCategory";
import { CreateCommunityDto } from "../../dto/mobile/Community.dto";
interface RequestWithUser extends Request {
  user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/star-update")
export class StarUpdateController {
  private repo = AppDataSource.getMongoRepository(StarUpdate);
  private communityRepository = AppDataSource.getMongoRepository(Community);
  private memberRepository = AppDataSource.getMongoRepository(Member);
  private chapterRepository = AppDataSource.getMongoRepository(Chapter);
  private regionRepository = AppDataSource.getMongoRepository(Region);
  private categoryRepository =
    AppDataSource.getMongoRepository(BusinessCategory);
  @Post("/")
  async create(
    @Body() body: any,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const data = new StarUpdate();

      data.chapterIds = body.chapterIds.map((id: string) => new ObjectId(id));
      data.categoryIds = body.categoryIds.map((id: string) => new ObjectId(id));

      data.title = body.title;
      data.lastDate = new Date(body.lastDate);
      data.details = body.details;
      data.location = body.location;

      data.isActive = 1;
      data.isDelete = 0;
      data.createdBy = new ObjectId(req.user.userId);
      data.updatedBy = new ObjectId(req.user.userId);

      const saved = await this.repo.save(data);

      return response(res, StatusCodes.CREATED, "Star update created", saved);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
  @Get("/")
  async getAll(
    @QueryParams() query: any,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 10);
      const member = await this.memberRepository.findOne({
        where: {
          _id: new ObjectId(req.user.userId),
          isDelete: 0,
        },
      });

      if (!member) {
        return response(res, StatusCodes.NOT_FOUND, "Member not found");
      }

      const match = {
        isDelete: 0,
        chapterIds: { $in: [member.chapter] },
        categoryIds: { $in: [member.businessCategory] },
      };
      const pipeline: any[] = [{ $match: match }, { $sort: { createdAt: -1 } }];
      if (limit > 0) {
        pipeline.push({ $skip: page * limit }, { $limit: limit });
      }
      const updates = await this.repo.aggregate(pipeline).toArray();
      const total = await this.repo.countDocuments(match);
      if (!updates.length) {
        return pagination(total, [], limit, page, res);
      }
      const chapterIds = updates.flatMap((u) => u.chapterIds || []);
      const categoryIds = updates.flatMap((u) => u.categoryIds || []);

      const chapters = await this.chapterRepository.find({
        where: { _id: { $in: chapterIds }, isDelete: 0 },
      });

      const categories = await this.categoryRepository.find({
        where: { _id: { $in: categoryIds }, isDelete: 0 },
      });

      const chapterMap = new Map(
        chapters.map((c) => [c.id.toString(), c.chapterName]),
      );

      const categoryMap = new Map(
        categories.map((c) => [c.id.toString(), c.name]),
      );

      const result = updates.map((update) => ({
        ...update,
        chapters: update.chapterIds.map((id) => chapterMap.get(id.toString())),
        categories: update.categoryIds.map((id) =>
          categoryMap.get(id.toString()),
        ),
      }));

      return pagination(total, result, limit, page, res);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/:id")
  async getOne(@Param("id") id: string, @Res() res: Response) {
    try {
      const data = await this.repo.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0,
      });

      if (!data) return response(res, StatusCodes.NOT_FOUND, "Not found");

      return response(res, StatusCodes.OK, "Fetched", data);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
  @Post("/respond")
  async respondStarupdate(
    @Body() body: { starId: string; type: string },
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const userId = new ObjectId(req.user.userId);
      const starId = new ObjectId(body.starId);

      // ✅ Use SAME repository
      const starUpdate = await this.repo.findOne({
        where: { _id: starId, isDelete: 0 },
      });

      if (!starUpdate) {
        return response(
          res,
          StatusCodes.NOT_FOUND,
          "Star update not found",
          [],
        );
      }

      if (!starUpdate.responses) {
        starUpdate.responses = [];
      }

      // 🔒 Prevent duplicate response
      const alreadyResponded = starUpdate.responses.some(
        (r) => r.userId.toString() === userId.toString(),
      );

      if (alreadyResponded) {
        return response(
          res,
          StatusCodes.BAD_REQUEST,
          "Already responded to this star update",
          [],
        );
      }

      // ➕ Push response
      starUpdate.responses.push({
        userId,
        type: body.type,
        respondedAt: new Date(),
      });

      starUpdate.updatedAt = new Date();

      // ✅ Save correctly
      await this.repo.save(starUpdate);

      return response(
        res,
        StatusCodes.OK,
        "Response saved successfully",
        starUpdate.responses,
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  
}
