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
import { CreateBusinessCategoryDto, UpdateBusinessCategoryDto } from "../../dto/admin/BusinessCategory.dto";
import { BusinessCategory } from "../../entity/BusinessCategory";

interface RequestWithUser extends Request {
  user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/business-category")
export class BusinessCategoryController {
  private businessCategoryRepository = AppDataSource.getMongoRepository(BusinessCategory);

  @Post("/")
  async createBusinessCategory(
    @Body() body: CreateBusinessCategoryDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const exists = await this.businessCategoryRepository.findOneBy({
        name: body.name,
        isDelete: 0
      });

      if (exists) {
        return response(res, StatusCodes.CONFLICT, "Business category already exists");
      }

      const businessCategory = new BusinessCategory();
      businessCategory.name = body.name;
      businessCategory.isActive = body.isActive ?? 1;
      businessCategory.isDelete = 0;
      businessCategory.createdBy = new ObjectId(req.user.userId);
      businessCategory.updatedBy = new ObjectId(req.user.userId);

      const savedBusinessCategory = await this.businessCategoryRepository.save(businessCategory);

      return response(
        res,
        StatusCodes.CREATED,
        "Business category created successfully",
        savedBusinessCategory
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/")
  async getAllBusinessCategories(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {
      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 0);

      const match = { isDelete: 0 };

      const operation: any[] = [];

      operation.push({ $match: match });

      if (limit > 0) {
        operation.push(
          { $skip: page * limit },
          { $limit: limit }
        );
      }

      const businessCategories =
        await this.businessCategoryRepository
          .aggregate(operation)
          .toArray();

      const totalCount =
        await this.businessCategoryRepository.countDocuments(match);

      return pagination(
        totalCount,
        businessCategories,
        limit,
        page,
        res
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }


  @Get("/active")
  async getActiveBusinessCategories(@Res() res: Response) {
    try {
      const businessCategories = await this.businessCategoryRepository.find({
        isDelete: 0,
        isActive: 1
      });
      return response(res, StatusCodes.OK, "Active business categories fetched successfully", businessCategories);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/:id")
  async getBusinessCategoryById(@Param("id") id: string, @Res() res: Response) {
    try {
      const businessCategory = await this.businessCategoryRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!businessCategory) {
        return response(res, StatusCodes.NOT_FOUND, "Business category not found");
      }

      return response(res, StatusCodes.OK, "Business category fetched successfully", businessCategory);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id")
  async updateBusinessCategory(
    @Param("id") id: string,
    @Body() body: UpdateBusinessCategoryDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const businessCategory = await this.businessCategoryRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!businessCategory) {
        return response(res, StatusCodes.NOT_FOUND, "Business category not found");
      }

      if (body.name !== undefined) businessCategory.name = body.name;
      if (body.isActive !== undefined) businessCategory.isActive = body.isActive;

      businessCategory.updatedBy = new ObjectId(req.user.userId);

      const updatedBusinessCategory = await this.businessCategoryRepository.save(businessCategory);
      return response(res, StatusCodes.OK, "Business category updated successfully", updatedBusinessCategory);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Delete("/:id")
  async deleteBusinessCategory(@Param("id") id: string, @Res() res: Response) {
    try {
      const businessCategory = await this.businessCategoryRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!businessCategory) {
        return response(res, StatusCodes.NOT_FOUND, "Business category not found");
      }

      businessCategory.isDelete = 1;
      await this.businessCategoryRepository.save(businessCategory);

      return response(res, StatusCodes.OK, "Business category deleted successfully");
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id/toggle-active")
  async toggleActive(@Param("id") id: string, @Res() res: Response) {
    try {
      const businessCategory = await this.businessCategoryRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!businessCategory) {
        return response(res, StatusCodes.NOT_FOUND, "Business category not found");
      }

      businessCategory.isActive = businessCategory.isActive === 1 ? 0 : 1;
      const updatedBusinessCategory = await this.businessCategoryRepository.save(businessCategory);

      return response(
        res,
        StatusCodes.OK,
        `Business category ${businessCategory.isActive === 1 ? "activated" : "deactivated"} successfully`,
        updatedBusinessCategory
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
}
