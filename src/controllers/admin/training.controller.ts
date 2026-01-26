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
import { Training } from "../../entity/Training";
import { CreateTrainingDto, UpdateTrainingDto } from "../../dto/admin/TrainingDto";
import { AuthPayload } from "../../middlewares/AuthMiddleware";
import { generateTrainingId } from "../../utils/id.generator";

interface RequestWithUser extends Request {
  user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/training")
export class TrainingController {
  private trainingRepository = AppDataSource.getMongoRepository(Training);

  @Post("/")
  async createTraining(
    @Body() body: CreateTrainingDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const exists = await this.trainingRepository.findOneBy({
        title: body.title,
        isDelete: 0
      });

      if (exists) {
        return response(
          res,
          StatusCodes.CONFLICT,
          "Training with this title already exists");
      }

      const training = new Training();
      training.trainingId = await generateTrainingId();
      training.chapterIds = body.chapterIds.map(id => new ObjectId(id));
      training.title = body.title;
      training.description = body.description;
      training.trainerIds = body.trainerIds.map(id => new ObjectId(id));
      training.trainingDateTime = new Date(body.trainingDateTime);
      training.lastDateForApply = new Date(body.lastDateForApply);
      training.duration = body.duration;
      training.mode = body.mode;
      training.locationOrLink = body.locationOrLink;
      training.maxAllowed = body.maxAllowed;
      training.status = body.status;
      training.isActive = 1;
      training.isDelete = 0;
      training.createdBy = new ObjectId(req.user.userId);
      training.updatedBy = new ObjectId(req.user.userId);

      const savedTraining = await this.trainingRepository.save(training);

      return response(
        res,
        StatusCodes.CREATED,
        "Training created successfully",
        savedTraining
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/")
  async getAllTrainings(
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {
      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 0);

      const match = { isDelete: 0 };
      const pipeline: any[] = [{ $match: match }];

      if (limit > 0) {
        pipeline.push(
          { $skip: page * limit },
          { $limit: limit }
        );
      }

      const trainings = await this.trainingRepository
        .aggregate(pipeline)
        .toArray();

      const totalCount =
        await this.trainingRepository.countDocuments(match);

      return pagination(totalCount, trainings, limit, page, res);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Get("/:id")
  async getTrainingById(
    @Param("id") id: string,
    @Res() res: Response
  ) {
    try {
      const training = await this.trainingRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!training) {
        return response(res, StatusCodes.NOT_FOUND, "Training not found");
      }

      return response(
        res,
        StatusCodes.OK,
        "Training fetched successfully",
        training
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id")
  async updateTraining(
    @Param("id") id: string,
    @Body() body: UpdateTrainingDto,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {
      const training = await this.trainingRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!training) {
        return response(res, StatusCodes.NOT_FOUND, "Training not found");
      }

      if (body.chapterIds)
        training.chapterIds = body.chapterIds.map(id => new ObjectId(id));

      if (body.title !== undefined) training.title = body.title;
      if (body.description !== undefined) training.description = body.description;

      if (body.trainerIds)
        training.trainerIds = body.trainerIds.map(id => new ObjectId(id));

      if (body.trainingDateTime)
        training.trainingDateTime = new Date(body.trainingDateTime);

      if (body.lastDateForApply)
        training.lastDateForApply = new Date(body.lastDateForApply);

      if (body.duration !== undefined) training.duration = body.duration;
      if (body.mode !== undefined) training.mode = body.mode;
      if (body.locationOrLink !== undefined)
        training.locationOrLink = body.locationOrLink;

      if (body.maxAllowed !== undefined) training.maxAllowed = body.maxAllowed;
      if (body.status !== undefined) training.status = body.status;
      if (body.isActive !== undefined) training.isActive = body.isActive;

      training.updatedBy = new ObjectId(req.user.userId);

      const updatedTraining = await this.trainingRepository.save(training);

      return response(
        res,
        StatusCodes.OK,
        "Training updated successfully",
        updatedTraining
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Delete("/:id")
  async deleteTraining(
    @Param("id") id: string,
    @Res() res: Response
  ) {
    try {
      const training = await this.trainingRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!training) {
        return response(res, StatusCodes.NOT_FOUND, "Training not found");
      }

      training.isDelete = 1;
      await this.trainingRepository.save(training);

      return response(
        res,
        StatusCodes.OK,
        "Training deleted successfully"
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }

  @Put("/:id/toggle-active")
  async toggleActive(
    @Param("id") id: string,
    @Res() res: Response
  ) {
    try {
      const training = await this.trainingRepository.findOneBy({
        _id: new ObjectId(id),
        isDelete: 0
      });

      if (!training) {
        return response(res, StatusCodes.NOT_FOUND, "Training not found");
      }

      training.isActive = training.isActive === 1 ? 0 : 1;
      const updated = await this.trainingRepository.save(training);

      return response(
        res,
        StatusCodes.OK,
        `Training ${training.isActive ? "activated" : "deactivated"} successfully`,
        updated
      );
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
  @Post("/generate/id")
  async getTrainingId(@Req() req: RequestWithUser,
    @Res() res: Response) {
    const id = await generateTrainingId();
    return response(res, StatusCodes.OK, 'Training Id Created successfully', id);
  }
}
