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
  Req,
  Patch
} from "routing-controllers";
import { Response } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import { AppDataSource } from "../../data-source";
import { AuthMiddleware } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { Training } from "../../entity/Training";
import { CreateTrainingDto, UpdateTrainingDto } from "../../dto/admin/TrainingDto";
import { AuthPayload } from "../../middlewares/AuthMiddleware";
import { generateTrainingId } from "../../utils/id.generator";
import { TrainingParticipants } from "../../entity/TrainingParticipants";
import { ApiError } from "../../utils";

interface RequestWithUser extends Request {
  user: AuthPayload;
}

const generateMeetingQR = async (trainingId: string) => {
  const uploadDir = path.join(process.cwd(), "public", "training", "qr");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `training-${trainingId}.png`;
  const filePath = path.join(uploadDir, fileName);

  const qrData = `meetingId=${trainingId}`;

  await QRCode.toFile(filePath, qrData, {
    width: 300,
    margin: 2,
  });

  return {
    fileName,
    path: `/training/qr/${fileName}`,
    originalName: fileName,
  };
};

@UseBefore(AuthMiddleware)
@JsonController("/training")
export class TrainingController {
  private trainingRepository = AppDataSource.getMongoRepository(Training);
  private participantsRepository = AppDataSource.getMongoRepository(TrainingParticipants);

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
      training.trainingFee = body.trainingFee;
      training.isActive = 1;
      training.isDelete = 0;
      training.createdBy = new ObjectId(req.user.userId);
      training.updatedBy = new ObjectId(req.user.userId);

      const savedTraining = await this.trainingRepository.save(training);
      const qrImage = await generateMeetingQR(savedTraining.id.toString());

      await this.trainingRepository.update(savedTraining.id, { qrImage });

      savedTraining.qrImage = qrImage;
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

      const page = Math.max(Number(query.page) || 0, 0);
      const limit = Math.max(Number(query.limit) || 0, 0);
      const search = query.search?.toString();

      const match: any = {
        isDelete: 0
      };

      // 🔍 SEARCH
      if (search) {
        match.$or = [
          { trainingId: { $regex: search, $options: "i" } },
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { status: { $elemMatch: { $regex: search, $options: "i" } } },

          // search trainingFee as string
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$trainingFee" },
                regex: search,
                options: "i"
              }
            }
          }
        ];
      }

      const pipeline: any[] = [
        { $match: match },

        {
          $sort: {
            isActive: -1,
            createdAt: -1
          }
        }
      ];

      if (limit > 0) {
        pipeline.push(
          { $skip: page * limit },
          { $limit: limit }
        );
      }

      const trainings =
        await this.trainingRepository
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

      if (body.trainingFee !== undefined) training.trainingFee = body.trainingFee;

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

  @Patch("/:id/toggle-active")
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
        `Training ${training.isActive ? "enabled" : "disabled"} successfully`,
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
  @Get("/training-participants/:id")
  async getAllTrainingsParticipants(
    @Param('id') id: string,
    @QueryParams() query: any,
    @Res() res: Response
  ) {
    try {
      const page = Number(query.page ?? 0);
      const limit = Number(query.limit ?? 10);

      const match = { isDelete: 0, trainingId: new ObjectId(id) };
      const pipeline: any[] = [{ $match: match }];

      if (limit > 0) {
        pipeline.push(
          { $skip: page * limit },
          { $limit: limit }
        );
      }
      pipeline.push(
        {
          $lookup: {
            from: "member",
            localField: "memberId",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "chapters",
                  localField: "chapter",
                  foreignField: "_id",
                  pipeline: [
                    {
                      $project: {
                        _id: 0,
                        chapterName: 1
                      }
                    }
                  ],
                  as: "chapterData"
                }
              },
              { $unwind: { path: "$chapterData", preserveNullAndEmptyArrays: true } },

              {
                $project: {
                  _id: 1,
                  fullName: 1,
                  profileImage: 1,
                  phoneNumber: 1,
                  email: 1,
                  companyName: 1,
                  chapterName: "$chapterData.chapterName"   // 💥 Push inside member
                }
              }
            ],
            as: "member"
          }
        }
      );

      const trainings = await this.participantsRepository
        .aggregate(pipeline)
        .toArray();

      const totalCount =
        await this.participantsRepository.countDocuments(match);

      return pagination(totalCount, trainings, limit, page, res);
    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }
  @Put('/status/:id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: RequestWithUser,
    @Res() res: Response
  ) {
    try {

      const updateData: any = {
        updatedBy: new ObjectId(req.user.userId),
        updatedAt: new Date()
      };

      if (body.status !== undefined) {
        updateData.status = body.status;
      }

      if (body.paymentStatus !== undefined) {
        updateData.paymentStatus = body.paymentStatus;
      }

      if (!updateData.status && !updateData.paymentStatus) {
        return response(
          res,
          StatusCodes.BAD_REQUEST,
          "status or paymentStatus is required"
        );
      }

      const result = await this.participantsRepository.findOneAndUpdate(
        {
          _id: new ObjectId(id),
          isDelete: 0
        },
        { $set: updateData },
        { returnDocument: "after" }
      );

      if (!result) {
        throw new ApiError(400, "Training Participants data not found");
      }

      return response(
        res,
        StatusCodes.OK,
        "Status Updated Successfully"
      );

    } catch (error) {
      return handleErrorResponse(error, res);
    }
  }


}
