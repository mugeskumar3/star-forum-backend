import {
  JsonController,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  QueryParams,
  Res,
  Req,
  UseBefore
} from "routing-controllers";
import { Response } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { Chapter } from "../../entity/Chapter";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";
import pagination from "../../utils/pagination";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import { CreateChapterDto, UpdateChapterDto } from "../../dto/admin/Chapter.dto";

@UseBefore(AuthMiddleware)
@JsonController("/chapters")
export class ChapterController {
  private chapterRepository = AppDataSource.getMongoRepository(Chapter);

  @Post("/")
  async createChapter(
    @Body() body: CreateChapterDto,
    @Req() req: any,
    @Res() res: Response
  ) {
    try {
      const chapter = this.chapterRepository.create({
        chapterName: body.chapterName,
        country: body.country,
        state: body.state,
        zoneId: new ObjectId(body.zoneId),
        regionId: new ObjectId(body.regionId),
        edId: new ObjectId(body.edId),
        rdId: new ObjectId(body.rdId),
        createdDate: new Date(body.createdDate),
        location: body.location,
        weekday: body.weekday,
        meetingType: body.meetingType,
        isActive: body.isActive ?? 1,
        isDelete: 0,
        createdBy: new ObjectId(req.user.userId),
        updatedBy: new ObjectId(req.user.userId)
      });

      await this.chapterRepository.save(chapter);

      return response(
        res,
        StatusCodes.CREATED,
        "Chapter created successfully",
        chapter
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/")
async getAllChapters(
  @QueryParams() query: any,
  @Res() res: Response
) {
  try {
    const page = Number(query.page ?? 0);
    const limit = Number(query.limit ?? 0);
    const search = query.search?.trim();

    const match: any = { isDelete: 0 };

    if (query.isActive !== undefined) {
      match.isActive = Number(query.isActive);
    }

    if (query.zoneId) {
      match.zoneId = new ObjectId(query.zoneId);
    }

    if (query.regionId) {
      match.regionId = new ObjectId(query.regionId);
    }

    if (query.edId) {
      match.edId = new ObjectId(query.edId);
    }

    if (query.rdId) {
      match.rdId = new ObjectId(query.rdId);
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: "zones",
          let: { zoneId: "$zoneId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$zoneId"] } } },
            { $project: { _id: 0, name: 1, country: 1, state: 1 } }
          ],
          as: "zone"
        }
      },
      { $unwind: { path: "$zone", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "regions",
          let: { regionId: "$regionId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$regionId"] } } },
            { $project: { _id: 0, region: 1 } }
          ],
          as: "region"
        }
      },
      { $unwind: { path: "$region", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "adminusers",
          let: { edId: "$edId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$edId"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "ed"
        }
      },
      { $unwind: { path: "$ed", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "adminusers",
          let: { rdId: "$rdId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$rdId"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "rd"
        }
      },
      { $unwind: { path: "$rd", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "adminusers",
          let: { createdBy: "$createdBy" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$createdBy"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "createdByUser"
        }
      },
      { $unwind: { path: "$createdByUser", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "adminusers",
          let: { updatedBy: "$updatedBy" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$updatedBy"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "updatedByUser"
        }
      },
      { $unwind: { path: "$updatedByUser", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          zoneName: "$zone.name",
          country: "$zone.country",
          state: "$zone.state",
          regionName: "$region.region",
          edName: "$ed.name",
          rdName: "$rd.name",
          createdByName: "$createdByUser.name",
          updatedByName: "$updatedByUser.name"
        }
      }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { chapterName: { $regex: search, $options: "i" } },
            { zoneName: { $regex: search, $options: "i" } },
            { regionName: { $regex: search, $options: "i" } },
            { edName: { $regex: search, $options: "i" } },
            { rdName: { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    if (limit > 0) {
      pipeline.push(
        { $skip: page * limit },
        { $limit: limit }
      );
    }

    pipeline.push({
      $project: {
        chapterName: 1,
        createdDate: 1,
        location: 1,
        weekday: 1,
        meetingType: 1,
        isActive: 1,

        zoneId: 1,
        zoneName: 1,
        country: 1,
        state: 1,

        regionId: 1,
        regionName: 1,

        edName: 1,
        rdName: 1,
        createdByName: 1,
        updatedByName: 1
      }
    });

    const data = await this.chapterRepository
      .aggregate(pipeline)
      .toArray();

    // =========================
    const countPipeline = pipeline.filter(
      stage =>
        !("$skip" in stage) &&
        !("$limit" in stage) &&
        !("$project" in stage)
    );

    countPipeline.push({ $count: "count" });

    const countResult = await this.chapterRepository
      .aggregate(countPipeline)
      .toArray();

    const totalCount = countResult[0]?.count ?? 0;

    return pagination(totalCount, data, limit, page, res);

  } catch (error) {
    return handleErrorResponse(error, res);
  }
}

@Get("/:id")
async getChapterById(
  @Param("id") id: string,
  @Res() res: Response
) {
  try {
    const match = {
      _id: new ObjectId(id),
      isDelete: 0
    };

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: "zones",
          let: { zoneId: "$zoneId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$zoneId"] } } },
            { $project: { _id: 0, name: 1, country: 1, state: 1 } }
          ],
          as: "zone"
        }
      },
      { $unwind: { path: "$zone", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "regions",
          let: { regionId: "$regionId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$regionId"] } } },
            { $project: { _id: 0, region: 1 } }
          ],
          as: "region"
        }
      },
      { $unwind: { path: "$region", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "adminusers",
          let: { edId: "$edId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$edId"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "ed"
        }
      },
      { $unwind: { path: "$ed", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "adminusers",
          let: { rdId: "$rdId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$rdId"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "rd"
        }
      },
      { $unwind: { path: "$rd", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "adminusers",
          let: { createdBy: "$createdBy" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$createdBy"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "createdByUser"
        }
      },
      { $unwind: { path: "$createdByUser", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "adminusers",
          let: { updatedBy: "$updatedBy" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$updatedBy"] } } },
            { $project: { _id: 0, name: 1 } }
          ],
          as: "updatedByUser"
        }
      },
      { $unwind: { path: "$updatedByUser", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          chapterName: 1,
          createdDate: 1,
          location: 1,
          weekday: 1,
          meetingType: 1,
          isActive: 1,

          zoneId: 1,
          zoneName: "$zone.name",
          country: "$zone.country",
          state: "$zone.state",

          regionId: 1,
          regionName: "$region.region",

          edName: "$ed.name",
          rdName: "$rd.name",
          createdByName: "$createdByUser.name",
          updatedByName: "$updatedByUser.name"
        }
      }
    ];

    const result = await this.chapterRepository
      .aggregate(pipeline)
      .toArray();

    if (!result.length) {
      return response(res, StatusCodes.NOT_FOUND, "Chapter not found");
    }

    return response(
      res,
      StatusCodes.OK,
      "Chapter fetched successfully",
      result[0]
    );

  } catch (error) {
    return handleErrorResponse(error, res);
  }
}


  @Put("/:id")
  async updateChapter(
    @Param("id") id: string,
    @Body() body: UpdateChapterDto,
    @Req() req: any,
    @Res() res: Response
  ) {
    try {
      const chapter = await this.chapterRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!chapter) {
        return response(
          res,
          StatusCodes.NOT_FOUND,
          "Chapter not found"
        );
      }

      if (body.zoneId) chapter.zoneId = new ObjectId(body.zoneId);
      if (body.regionId) chapter.regionId = new ObjectId(body.regionId);
      if (body.edId) chapter.edId = new ObjectId(body.edId);
      if (body.rdId) chapter.rdId = new ObjectId(body.rdId);
 
      if (body.createdDate) {
        chapter.createdDate = new Date(body.createdDate);
      }

      Object.assign(chapter, {
        ...body,
        updatedBy: new ObjectId(req.user.userId)
      });

      await this.chapterRepository.save(chapter);

      return response(
        res,
        StatusCodes.OK,
        "Chapter updated successfully",
        chapter
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Delete("/:id")
  async deleteChapter(
    @Param("id") id: string,
    @Res() res: Response
  ) {
    try {
      const chapter = await this.chapterRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!chapter) {
        return response(
          res,
          StatusCodes.NOT_FOUND,
          "Chapter not found"
        );
      }

      chapter.isDelete = 1;
      await this.chapterRepository.save(chapter);

      return response(
        res,
        StatusCodes.OK,
        "Chapter deleted successfully"
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
}
