import {
    JsonController,
    Get,
    Put,
    Req,
    Res,
    Body,
    UseBefore
} from "routing-controllers";
import { Response, Request } from "express";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";

import { AppDataSource } from "../../data-source";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import response from "../../utils/response";
import handleErrorResponse from "../../utils/commonFunction";
import { Member } from "../../entity/Member";
import { UpdateProfileDto } from "../../dto/mobile/Profile.dto";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/profile")
export class MobileProfileController {
    private memberRepository = AppDataSource.getMongoRepository(Member);

    // =========================
    // ✅ GET PROFILE
    // =========================
    @Get("/")
    async getProfile(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const userId = new ObjectId(req.user.userId);

            const pipeline = [
                {
                    $match: {
                        _id: userId,
                        isDelete: 0
                    }
                },
                // 🔹 Lookup Region
                {
                    $lookup: {
                        from: "regions",
                        localField: "region",
                        foreignField: "_id",
                        as: "regionDetails"
                    }
                },
                { $unwind: { path: "$regionDetails", preserveNullAndEmptyArrays: true } },

                // 🔹 Lookup Chapter
                {
                    $lookup: {
                        from: "chapters",
                        localField: "chapter",
                        foreignField: "_id",
                        as: "chapterDetails"
                    }
                },
                { $unwind: { path: "$chapterDetails", preserveNullAndEmptyArrays: true } },

                // 🔹 Lookup Business Category
                {
                    $lookup: {
                        from: "businesscategories",
                        localField: "businessCategory",
                        foreignField: "_id",
                        as: "businessCategoryDetails"
                    }
                },
                { $unwind: { path: "$businessCategoryDetails", preserveNullAndEmptyArrays: true } },

                // 🔹 Lookup Zone (using zoneId from Region or Chapter? Member doesn't have direct zoneId usually, but Chapter does)
                // Assuming we get zone name from the Chapter's zoneId
                {
                    $lookup: {
                        from: "zones",
                        let: { zoneId: "$chapterDetails.zoneId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$zoneId"] } } },
                            { $project: { _id: 0, name: 1 } }
                        ],
                        as: "zoneDetails"
                    }
                },
                { $unwind: { path: "$zoneDetails", preserveNullAndEmptyArrays: true } },


                // 🔹 Lookup Role (Static ID as requested)
                {
                    $lookup: {
                        from: "roles",
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", { $toObjectId: "6979be9d7cec48559e369009" }] } } },
                            { $project: { _id: 0, name: 1 } }
                        ],
                        as: "roleDetails"
                    }
                },
                { $unwind: { path: "$roleDetails", preserveNullAndEmptyArrays: true } },

                // 🔹 Lookup Chapter Badges
                {
                    $lookup: {
                        from: "badges", // Verify collection name from Badge entity (usually 'badges')
                        let: { badgeIds: { $ifNull: ["$chapterDetails.badgeIds", []] } },
                        pipeline: [
                            { $match: { $expr: { $in: ["$_id", "$$badgeIds"] } } },
                            // { $project: { _id: 1, name: 1, image: 1 } } // Project visible fields if needed, or get all
                        ],
                        as: "chapterBadgeDetails"
                    }
                },

                // 🔹 Project/Format Fields
                {
                    $addFields: {
                        region: { $ifNull: ["$regionDetails.region", ""] },
                        chapter: { $ifNull: ["$chapterDetails.chapterName", ""] },
                        businessCategory: { $ifNull: ["$businessCategoryDetails.name", ""] },
                        zone: { $ifNull: ["$zoneDetails.name", ""] },
                        role: { $ifNull: ["$roleDetails.name", ""] },
                        chapterBadge: "$chapterBadgeDetails.name",

                        // Ensure empty strings for specified fields if missing
                        about: { $ifNull: ["$about", ""] },
                        websiteUrl: { $ifNull: ["$websiteUrl", ""] },
                        instagramUrl: { $ifNull: ["$instagramUrl", ""] },
                        linkedinUrl: { $ifNull: ["$linkedinUrl", ""] },
                        twitterUrl: { $ifNull: ["$twitterUrl", ""] },
                        gstNumber: { $ifNull: ["$gstNumber", ""] },
                        panCard: { $ifNull: ["$panCard", ""] },
                        bloodGroup: { $ifNull: ["$bloodGroup", ""] },
                        country: { $ifNull: ["$country", ""] },
                    }
                },

                // 🔹 Remove extra lookup objects
                {
                    $project: {
                        regionDetails: 0,
                        chapterDetails: 0,
                        businessCategoryDetails: 0,
                        zoneDetails: 0,
                        roleDetails: 0,
                        chapterBadgeDetails: 0,
                        pin: 0 // security
                    }
                }
            ];

            const result = await this.memberRepository.aggregate(pipeline).toArray();

            if (!result.length) {
                return response(res, StatusCodes.NOT_FOUND, "Member not found");
            }

            return response(
                res,
                StatusCodes.OK,
                "Profile fetched successfully",
                result[0]
            );

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    // =========================
    // ✅ UPDATE PROFILE
    // =========================
    @Put("/")
    async updateProfile(
        @Body() body: UpdateProfileDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const userId = new ObjectId(req.user.userId);
            const member = await this.memberRepository.findOneBy({
                _id: userId,
                isDelete: 0
            });

            if (!member) {
                return response(res, StatusCodes.NOT_FOUND, "Member not found");
            }

            // Update only allowed fields
            if (body.about !== undefined) member.about = body.about;
            if (body.websiteUrl !== undefined) member.websiteUrl = body.websiteUrl;
            if (body.instagramUrl !== undefined) member.instagramUrl = body.instagramUrl;
            if (body.linkedinUrl !== undefined) member.linkedinUrl = body.linkedinUrl;
            if (body.twitterUrl !== undefined) member.twitterUrl = body.twitterUrl;
            if (body.gstNumber !== undefined) member.gstNumber = body.gstNumber;
            if (body.panCard !== undefined) member.panCard = body.panCard;
            if (body.bloodGroup !== undefined) member.bloodGroup = body.bloodGroup;
            if (body.country !== undefined) member.country = body.country;
            if (body.profileImage !== undefined) {
                member.profileImage = {
                    ...member.profileImage,
                    ...body.profileImage
                };
            }

            member.updatedBy = userId;

            const updatedMember = await this.memberRepository.save(member);

            return response(
                res,
                StatusCodes.OK,
                "Profile updated successfully",
                updatedMember
            );

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
}
