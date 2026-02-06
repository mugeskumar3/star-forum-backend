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
  Patch,
} from "routing-controllers";

import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";

import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { Community } from "../../entity/Community";
import { Member } from "../../entity/Member";
import { Chapter } from "../../entity/Chapter";
import { Region } from "../../entity/Region";
import { BusinessCategory } from "../../entity/BusinessCategory";
import { CreateCommunityDto } from "../../dto/mobile/Community.dto";
import { StarUpdate } from "../../entity/StarUpdate";

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

  // ➕ CREATE
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
      if (body.image !== undefined) data.image = body.image;

      data.title = body.title;
      data.lastDate = new Date(body.lastDate);
      data.details = body.details;
      data.location = body.location;


      data.isActive = 1;
      data.isDelete = 0;
      data.createdBy = new ObjectId(req.user.userId);
      data.updatedBy = new ObjectId(req.user.userId);

      const saved = await this.repo.save(data);

      return response(res, StatusCodes.CREATED, "Star update created successfully", saved);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/")
  async getAll(@QueryParams() query: any, @Res() res: Response) {
    try {
      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 10);

      const match = { isDelete: 0 };

      const pipeline: any[] = [{ $match: match }, {
        $sort: {
          isActive: -1,
          createdAt: -1
        }
      },];

      if (limit > 0) {
        pipeline.push({ $skip: page * limit }, { $limit: limit });
      }

      const list = await this.repo.aggregate(pipeline).toArray();

      const total = await this.repo.countDocuments(match);

      return pagination(total, list, limit, page, res);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/:id")
  async getOne(@Param("id") id: string, @Res() res: Response) {
    try {
      const starId = new ObjectId(id);

      const starUpdate = await this.repo.findOne({
        where: { _id: starId, isDelete: 0 },
      });

      if (!starUpdate) {
        return response(res, StatusCodes.NOT_FOUND, "Star update not found");
      }

      // ─── CHAPTERS ─────────────────────

      const chapters = await this.chapterRepository.find({
        where: {
          _id: { $in: starUpdate.chapterIds || [] },
          isDelete: 0,
        },
      });

      const chapterNames = chapters.map((c) => c.chapterName);

      // ─── CATEGORIES ───────────────────

      const categories = await this.categoryRepository.find({
        where: {
          _id: { $in: starUpdate.categoryIds || [] },
          isDelete: 0,
        },
      });

      const categoryNames = categories.map((c) => c.name);

      // ─── USER DETAILS FROM RESPONSES ──

      let responseUsers: any[] = [];

      if (starUpdate.responses?.length) {
        const userIds = starUpdate.responses.map((r) => r.userId);

        const members = await this.memberRepository.find({
          where: {
            _id: { $in: userIds },
            isDelete: 0,
          },
        });

        const memberMap = new Map(members.map((m) => [m.id.toString(), m]));

        responseUsers = starUpdate.responses.map((r) => {
          const member = memberMap.get(r.userId.toString());

          return {
            userId: r.userId,
            fullName: member?.fullName || "",
            profileImage: member?.profileImage?.path || "",
            email: member?.email || "",
            companyName: member?.companyName || "",
            type: r.type,
            respondedAt: r.respondedAt,
          };
        });
      }

      // ─── FINAL RESPONSE ───────────────

      const result = {
        ...starUpdate,
        chapters: chapterNames,
        categories: categoryNames,
        responses: responseUsers,
      };

      return response(res, StatusCodes.OK, "Star update fetched successfully", result);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id")
  async update(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const data = await this.repo.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0,
      });

      if (!data) return response(res, StatusCodes.NOT_FOUND, "Not found");

      if (body.chapterIds)
        data.chapterIds = body.chapterIds.map((id: string) => new ObjectId(id));

      if (body.categoryIds)
        data.categoryIds = body.categoryIds.map(
          (id: string) => new ObjectId(id),
        );

      if (body.title !== undefined) data.title = body.title;

      if (body.image !== undefined) data.image = body.image;

      if (body.lastDate !== undefined) data.lastDate = new Date(body.lastDate);

      if (body.details !== undefined) data.details = body.details;

      if (body.location !== undefined) data.location = body.location;

      data.updatedBy = new ObjectId(req.user.userId);

      const updated = await this.repo.save(data);

      return response(res, StatusCodes.OK, "Star update updated successfully", updated);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Delete("/:id")
  async delete(@Param("id") id: string, @Res() res: Response) {
    try {
      const data = await this.repo.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0,
      });

      if (!data) return response(res, StatusCodes.NOT_FOUND, "Not found");

      data.isDelete = 1;
      await this.repo.save(data);

      return response(res, StatusCodes.OK, "Deleted");
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/responses/full-details/:id")
  async getStarResponsesFull(@Param("id") id: string, @Res() res: Response) {
    try {
      const startId = new ObjectId(id);

      const community = await this.repo.findOne({
        where: { _id: startId, isDelete: 0 },
      });

      if (!community || !community.responses?.length) {
        return response(res, StatusCodes.OK, "No responses", []);
      }

      const userIds = community.responses.map((r) => r.userId);
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
      const chapters = await this.chapterRepository.find({
        where: { _id: { $in: chapterIds }, isDelete: 0 },
      });

      const regionIds = chapters.map((c) => c.regionId).filter(Boolean);

      const regions = await this.regionRepository.find({
        where: { _id: { $in: regionIds }, isDelete: 0 },
      });

      const categories = await this.categoryRepository.find({
        where: { _id: { $in: categoryIds }, isDelete: 0 },
      });

      const chapterMap = new Map(
        chapters.map((c) => [c.id.toString(), c.chapterName]),
      );

      const regionMap = new Map(
        regions.map((r) => [r.id.toString(), r.region]),
      );

      const categoryMap = new Map(
        categories.map((c) => [c.id.toString(), c.name]),
      );
      const memberMap = new Map(members.map((m) => [m.id.toString(), m]));
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
  @Patch("/:id/toggle-active")
  async toggleActive(@Param("id") id: string, @Res() res: Response) {
    try {
      const star = await this.repo.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!star) {
        return response(res, StatusCodes.NOT_FOUND, "Star Update not found");
      }

      star.isActive = star.isActive === 1 ? 0 : 1;
      const updatedStar = await this.repo.save(star);
      return response(
        res,
        StatusCodes.OK,
        `Star Update ${updatedStar.isActive === 1 ? "enabled" : "disabled"} successfully`,
        updatedStar
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
}