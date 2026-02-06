// src/controllers/admin/chapter-role.controller.ts

import {
    JsonController,
    Post,
    Put,
    Get,
    Delete,
    Param,
    Body,
    Req,
    Res,
    UseBefore,
    Patch
} from "routing-controllers";
import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { ChapterRoleAssignment } from "../../entity/ChapterRoleAssignment";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import { AssignChapterRoleDto } from "../../dto/admin/ChapterRole.dto";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/chapter-roles")
export class ChapterRoleController {

    private repo =
        AppDataSource.getMongoRepository(ChapterRoleAssignment);


    @Post("/")
    async create(
        @Body() body: AssignChapterRoleDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {

            const exists = await this.repo.findOneBy({
                chapterId: new ObjectId(body.chapterId),
                roleId: new ObjectId(body.roleId),
                isDelete: 0
            });

            if (exists) {
                return response(
                    res,
                    StatusCodes.CONFLICT,
                    "Role already assigned"
                );
            }

            await this.repo.save({
                chapterId: new ObjectId(body.chapterId),
                roleId: new ObjectId(body.roleId),
                memberId: new ObjectId(body.memberId),
                createdBy: new ObjectId(req.user.userId),
                updatedBy: new ObjectId(req.user.userId),
                isDelete: 0
            });

            return response(
                res,
                StatusCodes.CREATED,
                "Role assigned successfully"
            );

        } catch (err) {
            console.error(err);
            return response(res, 500, "Failed to assign role");
        }
    }


    @Patch("/:id")
    async update(
        @Param("id") id: string,
        @Body() body: { memberId: string },
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {

            if (
                !ObjectId.isValid(id) ||
                !ObjectId.isValid(body.memberId)
            ) {
                return response(res, 400, "Invalid ObjectId");
            }

            const record = await this.repo.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!record) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Assignment not found"
                );
            }

            record.memberId = new ObjectId(body.memberId);
            record.updatedBy = new ObjectId(req.user.userId);

            await this.repo.save(record);

            return response(
                res,
                StatusCodes.OK,
                "Role updated successfully"
            );

        } catch (err) {
            console.error(err);
            return response(res, 500, "Failed to update role");
        }
    }


    @Get("/list/:chapterId")
    async listByChapter(
        @Param("chapterId") chapterId: string,
        @Res() res: Response
    ) {
        try {

            if (!ObjectId.isValid(chapterId)) {
                return response(res, 400, "Invalid chapterId");
            }

            const data = await this.repo.aggregate([

                {
                    $match: {
                        chapterId: new ObjectId(chapterId),
                        isDelete: 0
                    }
                },

                {
                    $lookup: {
                        from: "roles",
                        localField: "roleId",
                        foreignField: "_id",
                        as: "role"
                    }
                },
                { $unwind: "$role" },

                {
                    $lookup: {
                        from: "member",
                        let: { memberId: "$memberId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$_id", "$$memberId"] }
                                }
                            },
                            {
                                $project: {
                                    _id: 1,
                                    profileImage: 1,
                                    fullName: 1,
                                    phoneNumber: 1,
                                    email: 1,
                                    companyName: 1
                                }
                            }
                        ],
                        as: "member"
                    }
                },
                { $unwind: "$member" },

                {
                    $project: {
                        _id: 1,

                        roleName: "$role.name",
                        roleCode: "$role.code",

                        member: {
                            id: "$member._id",
                            profileImage: "$member.profileImage",
                            fullName: "$member.fullName",
                            phoneNumber: "$member.phoneNumber",
                            email: "$member.email",
                            companyName: "$member.companyName"
                        }
                    }
                }

            ]).toArray();

            return response(res, 200, "Success", data);

        } catch (err) {
            console.error(err);
            return response(res, 500, "Failed to fetch");
        }
    }


    @Delete("/:id")
    async remove(
        @Param("id") id: string,
        @Res() res: Response
    ) {
        try {

            if (!ObjectId.isValid(id)) {
                return response(res, 400, "Invalid id");
            }

            await this.repo.updateOne(
                { _id: new ObjectId(id) },
                { $set: { isDelete: 1 } }
            );

            return response(
                res,
                StatusCodes.OK,
                "Removed successfully"
            );

        } catch (err) {
            console.error(err);
            return response(res, 500, "Failed to remove");
        }
    }

}
