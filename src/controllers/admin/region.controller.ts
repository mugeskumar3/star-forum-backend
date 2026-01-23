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
import { Region } from "../../entity/Region";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { CreateRegionDto, UpdateRegionDto } from "../../dto/admin/Region.dto";
import { AuthPayload } from "../../middlewares/AuthMiddleware";

interface RequestWithUser extends Request {
  user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/region")
export class RegionController {
  private regionRepository = AppDataSource.getMongoRepository(Region);

  @Post("/")
  async createRegion(
    @Body() body: CreateRegionDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const exists = await this.regionRepository.findOneBy({
        zoneId: new ObjectId(body.zoneId),
        region: body.region,
        isDelete: 0
      });

      if (exists) {
        return response(res, StatusCodes.CONFLICT, "Region already exists in this zone");
      }

      const region = new Region();
      region.zoneId = new ObjectId(body.zoneId);
      region.region = body.region;
      region.edId = new ObjectId(body.edId);
      region.rdIds = body.rdIds.map(id => new ObjectId(id));
      region.isActive = body.isActive ?? 1;
      region.isDelete = 0;
      region.createdBy = new ObjectId(req.user.userId);
      region.updatedBy = new ObjectId(req.user.userId);

      const savedRegion = await this.regionRepository.save(region);

      return response(
        res,
        StatusCodes.CREATED,
        "Region created successfully",
        savedRegion
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/")
  async getAllRegions(@QueryParams() query: any, @Res() res: Response) {
    try {
      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 0);

      const match: any = { isDelete: 0 };

      if (query.zoneId) {
        match.zoneId = new ObjectId(query.zoneId);
      }

      if (query.isActive !== undefined) {
        match.isActive = Number(query.isActive);
      }

      const operation: any[] = [];

      operation.push({ $match: match });

      if (limit > 0) {
        operation.push(
          { $skip: page * limit },
          { $limit: limit }
        );
      }

      const regions = await this.regionRepository
        .aggregate(operation)
        .toArray();

      const totalCount =
        await this.regionRepository.countDocuments(match);

      return pagination(totalCount, regions, limit, page, res);

    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }


  @Get("/:id")
  async getRegionById(@Param("id") id: string, @Res() res: Response) {
    try {
      const region = await this.regionRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!region) {
        return response(res, StatusCodes.NOT_FOUND, "Region not found");
      }

      return response(res, StatusCodes.OK, "Region fetched successfully", region);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id")
  async updateRegion(
    @Param("id") id: string,
    @Body() body: UpdateRegionDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const region = await this.regionRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!region) {
        return response(res, StatusCodes.NOT_FOUND, "Region not found");
      }

      if (body.region !== undefined || body.zoneId !== undefined) {
        const regionName = body.region ?? region.region;
        const zoneId = body.zoneId ?? region.zoneId;

        const duplicate = await this.regionRepository.findOne({
          where: {
            region: regionName,
            zoneId: new ObjectId(zoneId),
            isDelete: 0,
            _id: { $ne: new ObjectId(id) }
          }
        });

        if (duplicate) {
          return response(
            res,
            StatusCodes.CONFLICT,
            "Region already exists in this zone"
          );
        }
      }

      if (body.zoneId !== undefined) {
        region.zoneId = new ObjectId(body.zoneId);
      }

      if (body.region !== undefined) {
        region.region = body.region;
      }

      if (body.edId !== undefined) {
        region.edId = new ObjectId(body.edId);
      }

      if (body.rdIds !== undefined) {
        region.rdIds = body.rdIds.map(id => new ObjectId(id));
      }

      if (body.isActive !== undefined) {
        region.isActive = body.isActive;
      }

      region.updatedBy = new ObjectId(req.user.userId);

      const updatedRegion = await this.regionRepository.save(region);

      return response(
        res,
        StatusCodes.OK,
        "Region updated successfully",
        updatedRegion
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }


  @Delete("/:id")
  async deleteRegion(@Param("id") id: string, @Res() res: Response) {
    try {
      const region = await this.regionRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!region) {
        return response(res, StatusCodes.NOT_FOUND, "Region not found");
      }

      region.isDelete = 1;
      await this.regionRepository.save(region);

      return response(res, StatusCodes.OK, "Region deleted successfully");
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id/toggle-active")
  async toggleActive(@Param("id") id: string, @Res() res: Response) {
    try {
      const region = await this.regionRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!region) {
        return response(res, StatusCodes.NOT_FOUND, "Region not found");
      }

      region.isActive = region.isActive === 1 ? 0 : 1;
      const updatedRegion = await this.regionRepository.save(region);

      return response(
        res,
        StatusCodes.OK,
        `Region ${region.isActive === 1 ? "activated" : "deactivated"
        } successfully`,
        updatedRegion
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
}
