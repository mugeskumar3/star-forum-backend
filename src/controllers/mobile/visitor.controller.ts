import {
    JsonController,
    Post,
    Put,
    Delete,
    Get,
    Param,
    Body,
    Req,
    Res,
    QueryParams,
    UseBefore
} from "routing-controllers";
import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { Visitor } from "../../entity/Visitor";

import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import pagination from "../../utils/pagination";
import { CreateVisitorDto } from "../../dto/mobile/Visitor.dto";
import { Member } from "../../entity/Member";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/visitor")
export class VisitorController {
    private visitorRepo = AppDataSource.getMongoRepository(Visitor);
    private memberRepo = AppDataSource.getMongoRepository(Member);

    @Post("/")
    async createVisitor(
        @Body() body: CreateVisitorDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {

            const member = await this.memberRepo.findOne({
                where: {
                    _id: new ObjectId(req.user.userId)
                }
            })

            const visitor = new Visitor();
            visitor.visitorName = body.visitorName;
            visitor.contactNumber = body.contactNumber;
            visitor.businessCategory = body.businessCategory;
            visitor.companyName = body.companyName;
            visitor.address = body.address;
            visitor.status = "Pending";
            visitor.visitorDate = body.visitorDate;
            visitor.email = body.email;
            visitor.chapterId = member.chapter;

            visitor.isActive = 1;
            visitor.isDelete = 0;
            visitor.createdBy = new ObjectId(req.user.userId);
            visitor.updatedBy = new ObjectId(req.user.userId);

            const saved = await this.visitorRepo.save(visitor);

            return response(
                res,
                StatusCodes.CREATED,
                "Visitor created successfully",
                saved
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    // =========================
    // ✅ UPDATE VISITOR
    // =========================
    @Put("/:id")
    async updateVisitor(
        @Param("id") id: string,
        @Body() body: CreateVisitorDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const visitor = await this.visitorRepo.findOne({
                where: { _id: new ObjectId(id), isDelete: 0 }
            });

            if (!visitor) {
                return response(res, StatusCodes.NOT_FOUND, "Visitor not found");
            }

            Object.assign(visitor, {
                ...body,
                businessCategory: body.businessCategory,
                updatedBy: new ObjectId(req.user.userId)
            });

            const updated = await this.visitorRepo.save(visitor);

            return response(
                res,
                StatusCodes.OK,
                "Visitor updated successfully",
                updated
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    // =========================
    // ✅ DELETE VISITOR (SOFT)
    // =========================
    @Delete("/:id")
    async deleteVisitor(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const visitor = await this.visitorRepo.findOne({
                where: { _id: new ObjectId(id), isDelete: 0 }
            });

            if (!visitor) {
                return response(res, StatusCodes.NOT_FOUND, "Visitor not found");
            }

            visitor.isDelete = 1;
            visitor.isActive = 0;
            visitor.updatedBy = new ObjectId(req.user.userId);

            await this.visitorRepo.save(visitor);

            return response(
                res,
                StatusCodes.OK,
                "Visitor deleted successfully"
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    // =========================
    // ✅ VISITOR DETAILS
    // =========================
    @Get("/details/:id")
    async visitorDetails(
        @Param("id") id: string,
        @Res() res: Response
    ) {
        try {
            const visitor = await this.visitorRepo.findOne({
                where: { _id: new ObjectId(id), isDelete: 0 }
            });

            if (!visitor) {
                return response(res, StatusCodes.NOT_FOUND, "Visitor not found");
            }

            return response(
                res,
                StatusCodes.OK,
                "Visitor details fetched successfully",
                visitor
            );
        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    // =========================
    // ✅ LIST VISITORS (AGGREGATION + MEMBER LOOKUP)
    // =========================
    @Get("/list")
    async listVisitors(
        @QueryParams() query: any,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(query.page) || 0, 0);
            const limit = Math.max(Number(query.limit) || 10, 1);
            const search = query.search?.toString();

            const match: any = { isDelete: 0 };

            if (search) {
                match.$or = [
                    { visitorName: { $regex: search, $options: "i" } },
                    { contactNumber: { $regex: search, $options: "i" } }
                ];
            }

            const pipeline = [
                { $match: match },

                // 🔹 Lookup member (Invited By)
                {
                    $lookup: {
                        from: "member",
                        localField: "createdBy",
                        foreignField: "_id",
                        as: "member"
                    }
                },
                {
                    $unwind: {
                        path: "$member",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: "chapters",
                        localField: "chapterId",
                        foreignField: "_id",
                        as: "chapters"
                    }
                },
                {
                    $unwind: {
                        path: "$chapters",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        visitorName: 1,
                        contactNumber: 1,
                        sourceOfEvent: 1,
                        status: 1,
                        businessCategory: 1,
                        companyName: 1,
                        email: 1,
                        address: 1,
                        createdAt: 1,
                        invitedBy: {
                            _id: "$member._id",
                            name: "$member.fullName"
                        },
                        chapterName: "$chapters.chapterName",
                        visitorDate: 1
                    }
                },

                { $sort: { createdAt: -1 } },

                {
                    $facet: {
                        data: [
                            { $skip: page },
                            { $limit: limit }
                        ],
                        meta: [{ $count: "total" }]
                    }
                }
            ];

            const [result] = await this.visitorRepo.aggregate(pipeline).toArray();

            const data = result?.data || [];
            const total = result?.meta?.[0]?.total || 0;

            return pagination(total, data, limit, page, res);
        } catch (error) {
            console.log(error);

            return handleErrorResponse(error, res);
        }
    }
}
