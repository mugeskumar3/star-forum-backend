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
  UseBefore,
  Req
} from "routing-controllers";
import { Response } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { AuthPayload } from "../../middlewares/AuthMiddleware";
import { Badge } from "../../entity/Badge";
import { CreateBadgeDto, UpdateBadgeDto } from "../../dto/admin/badge.dto";

interface RequestWithUser extends Request {
  user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/badge")
export class BadgeController {
  private badgeRepository = AppDataSource.getMongoRepository(Badge);

  @Post("/")
  async createBadge(
    @Body() body: CreateBadgeDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const exists = await this.badgeRepository.findOneBy({
        name: body.name,
        isDelete: 0
      });

      if (exists) {
        return response(res, StatusCodes.CONFLICT, "Badge already exists");
      }

      const badge = new Badge();
      badge.name = body.name;
      badge.type = body.type;
      badge.badgeImage = body.badgeImage;
      badge.isActive = body.isActive ?? 1;
      badge.isDelete = 0;
      badge.createdBy = new ObjectId(req.user.userId);
      badge.updatedBy = new ObjectId(req.user.userId);

      const savedBadge = await this.badgeRepository.save(badge);

      return response(
        res,
        StatusCodes.CREATED,
        "Badge created successfully",
        savedBadge
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/")
  async getAllBadges(@QueryParams() query: any, @Res() res: Response) {
    try {
      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 0);

      const match = { isDelete: 0 };

      const operation: any[] = [];

      operation.push({ $match: match }, { $sort: { createdAt: -1 } },);

      if (limit > 0) {
        operation.push(
          { $skip: page * limit },
          { $limit: limit }
        );
      }

      const badges = await this.badgeRepository
        .aggregate(operation)
        .toArray();

      const totalCount =
        await this.badgeRepository.countDocuments(match);

      return pagination(totalCount, badges, limit, page, res);

    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }


  @Get("/active")
  async getActiveBadges(@Res() res: Response) {
    try {
      const badges = await this.badgeRepository.find({
        isDelete: 0,
        isActive: 1
      });
      return response(res, StatusCodes.OK, "Active badges fetched successfully", badges);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/:id")
  async getBadgeById(@Param("id") id: string, @Res() res: Response) {
    try {
      const badge = await this.badgeRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!badge) {
        return response(res, StatusCodes.NOT_FOUND, "Badge not found");
      }

      return response(res, StatusCodes.OK, "Badge fetched successfully", badge);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id")
  async updateBadge(
    @Param("id") id: string,
    @Body() body: UpdateBadgeDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const badge = await this.badgeRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!badge) {
        return response(res, StatusCodes.NOT_FOUND, "Badge not found");
      }

      if (body.name) {
        const nameExists = await this.badgeRepository.findOne({
          where: {
            name: body.name,
            isDelete: 0,
            _id: { $ne: new ObjectId(id) }
          }
        });

        if (nameExists) {
          return response(
            res,
            StatusCodes.CONFLICT,
            "Badge name already exists"
          );
        }

        badge.name = body.name;
      }

      if (body.isActive !== undefined) {
        badge.isActive = body.isActive;
      }

      if (body.badgeImage !== undefined) {
        badge.badgeImage = body.badgeImage;
      }

      badge.updatedBy = new ObjectId(req.user.userId);

      const updatedBadge = await this.badgeRepository.save(badge);

      return response(
        res,
        StatusCodes.OK,
        "Badge updated successfully",
        updatedBadge
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Delete("/:id")
  async deleteBadge(@Param("id") id: string, @Res() res: Response) {
    try {
      const badge = await this.badgeRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!badge) {
        return response(res, StatusCodes.NOT_FOUND, "Badge not found");
      }

      badge.isDelete = 1;
      await this.badgeRepository.save(badge);

      return response(res, StatusCodes.OK, "Badge deleted successfully");
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id/toggle-active")
  async toggleActive(@Param("id") id: string, @Res() res: Response) {
    try {
      const badge = await this.badgeRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!badge) {
        return response(res, StatusCodes.NOT_FOUND, "Badge not found");
      }

      badge.isActive = badge.isActive === 1 ? 0 : 1;
      const updatedBadge = await this.badgeRepository.save(badge);

      return response(
        res,
        StatusCodes.OK,
        `Badge ${badge.isActive === 1 ? "activated" : "deactivated"} successfully`,
        updatedBadge
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
}
