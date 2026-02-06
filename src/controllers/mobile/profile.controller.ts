import {
    JsonController,
    Get,
    Put,
    Req,
    Res,
    Body,
    UseBefore,
    Param
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
import { Community } from "../../entity/Community";
import { TrainingParticipants } from "../../entity/TrainingParticipants";
import { ThankYouSlip } from "../../entity/ThankyouSlip";

interface RequestWithUser extends Request {
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/profile")
export class MobileProfileController {
    private memberRepo = AppDataSource.getMongoRepository(Member);
    private communityRepo = AppDataSource.getMongoRepository(Community);
    private participantRepo = AppDataSource.getMongoRepository(TrainingParticipants);
    private thankYouRepo = AppDataSource.getMongoRepository(ThankYouSlip);
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

                // 🔹 Lookup Attendance History
                {
                    $lookup: {
                        from: "attendance",
                        let: { memberId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$memberId", "$$memberId"] },
                                            { $eq: ["$isActive", 1] },
                                            { $eq: ["$isDelete", 0] },
                                            // Make sure sourceType is MEETING if specifically asked for "Meetings" history,
                                            // but "attendanceHistory" usually implies all sources or strictly meetings.
                                            // User said: "get meeting and attedence collection". 
                                            // Usually attendance tracks meetings.
                                            // Let's filter by sourceType: "MEETING" based on the request "totalMeating".
                                            { $eq: ["$sourceType", "MEETING"] }
                                        ]
                                    }
                                }
                            },
                        ],
                        as: "attendanceRecords"
                    }
                },

                // 🔹 Calculate Attendance Stats
                {
                    $addFields: {
                        attendanceHistory: {
                            totalMeetings: { $size: "$attendanceRecords" },
                            present: {
                                $size: {
                                    $filter: {
                                        input: "$attendanceRecords",
                                        as: "att",
                                        cond: { $eq: ["$$att.status", "present"] }
                                    }
                                }
                            },
                            late: {
                                $size: {
                                    $filter: {
                                        input: "$attendanceRecords",
                                        as: "att",
                                        cond: { $eq: ["$$att.status", "late"] }
                                    }
                                }
                            },
                            absent: {
                                $size: {
                                    $filter: {
                                        input: "$attendanceRecords",
                                        as: "att",
                                        cond: { $eq: ["$$att.status", "absent"] }
                                    }
                                }
                            },
                            proxy: {
                                $size: {
                                    $filter: {
                                        input: "$attendanceRecords",
                                        as: "att",
                                        cond: {
                                            $or: [
                                                { $eq: ["$$att.status", "proxcy"] },
                                                { $eq: ["$$att.status", "substitute"] }
                                            ]
                                        }
                                    }
                                }
                            },
                            medical: {
                                $size: {
                                    $filter: {
                                        input: "$attendanceRecords",
                                        as: "att",
                                        cond: { $eq: ["$$att.status", "medical"] }
                                    }
                                }
                            }
                        }
                    }
                },

                // 🔹 Project/Format Fields
                {
                    $addFields: {
                        region: { $ifNull: ["$regionDetails.region", ""] },
                        chapter: { $ifNull: ["$chapterDetails.chapterName", ""] },
                        absentLimit: { $ifNull: ["$chapterDetails.absentLimit", ""] },
                        proxyLimit: { $ifNull: ["$chapterDetails.proxyLimit", ""] },
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

            const result = await this.memberRepo.aggregate(pipeline).toArray();

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
            const member = await this.memberRepo.findOneBy({
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
            if (body.officeAddress !== undefined) {
                member.officeAddress = {
                    ...member.officeAddress,
                    ...body.officeAddress
                };
            }

            member.updatedBy = userId;

            const updatedMember = await this.memberRepo.save(member);

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
    @Get("/overview/:memberId")
    async getProfileOverview(
        @Req() req: RequestWithUser,
        @Param("memberId") memberId: string,
        @Res() res: Response
    ) {
        try {

            if (!ObjectId.isValid(memberId)) {
                return response(res, 400, "Invalid memberId");
            }

            const memberObjectId = new ObjectId(memberId);

            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);
            const type = req.query.type?.toString();

            /* ---------------- MEMBER PROFILE PIPELINE ---------------- */

            const profilePipeline: any[] = [
                { $match: { _id: memberObjectId, isDelete: 0 } },

                {
                    $lookup: {
                        from: "roles",
                        let: { roleId: "$roleId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$roleId"] } } },
                            { $project: { _id: 0, name: 1 } }
                        ],
                        as: "role"
                    }
                },
                { $unwind: { path: "$role", preserveNullAndEmptyArrays: true } },

                {
                    $lookup: {
                        from: "regions",
                        let: { regionId: "$region" },
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
                        from: "businesscategories",
                        let: { catId: "$businessCategory" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$catId"] } } },
                            { $project: { _id: 0, name: 1 } }
                        ],
                        as: "businessCategory"
                    }
                },
                { $unwind: { path: "$businessCategory", preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: "connection_request",
                        let: { myId: memberObjectId },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$status", "Approved"] },
                                            { $eq: ["$isActive", 1] },
                                            { $eq: ["$isDelete", 0] },
                                            {
                                                $or: [
                                                    { $eq: ["$memberId", "$$myId"] },
                                                    { $eq: ["$createdBy", "$$myId"] }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },

                            {
                                $addFields: {
                                    otherMemberId: {
                                        $cond: [
                                            { $eq: ["$memberId", "$$myId"] },
                                            "$createdBy",
                                            "$memberId"
                                        ]
                                    }
                                }
                            },

                            {
                                $lookup: {
                                    from: "member",
                                    localField: "otherMemberId",
                                    foreignField: "_id",
                                    as: "user"
                                }
                            },
                            { $unwind: "$user" },

                            { $sort: { createdAt: -1 } },

                            {
                                $project: {
                                    _id: 0,
                                    fullName: "$user.fullName",
                                    profileImage: "$user.profileImage"
                                }
                            }
                        ],
                        as: "connections"
                    }
                },
                {
                    $addFields: {
                        totalConnections: { $size: "$connections" },
                        lastConnections: { $slice: ["$connections", 5] }
                    }
                },
                {
                    $project: {
                        profileImage: 1,
                        fullName: 1,
                        companyName: 1,
                        membershipId: 1,
                        phoneNumber: 1,
                        email: 1,
                        about: 1,
                        roleName: "$role.name",
                        regionName: "$region.region",
                        businessCategoryName: "$businessCategory.name",
                        websiteUrl: 1,
                        instagramUrl: 1,
                        linkedinUrl: 1,
                        twitterUrl: 1,
                        createdAt: 1,
                        totalConnections: 1,
                        lastConnections: 1,
                        address: {
                            street: "$officeAddress.street",
                            area: "$officeAddress.area",
                            city: "$officeAddress.city",
                            state: "$officeAddress.state",
                            pincode: "$officeAddress.pincode",
                            country: "$country"
                        },
                    }
                }
            ];

            /* ---------------- COMMUNITY PIPELINE ---------------- */

            const communityMatch: any = {
                isDelete: 0,
                createdBy: memberObjectId
            };

            if (type) communityMatch.type = type;

            const communityPipeline: any[] = [
                { $match: communityMatch },
                { $sort: { createdAt: -1 } },
                { $skip: page * limit },
                { $limit: limit },
                {
                    $project: {
                        title: 1,
                        details: 1,
                        type: 1
                    }
                }
            ];

            /* ---------------- TRAINING HISTORY PIPELINE ---------------- */

            const trainingPipeline: any[] = [
                {
                    $match: {
                        memberId: memberObjectId,
                        status: "Approved",
                        isActive: 1,
                        isDelete: 0
                    }
                },
                {
                    $lookup: {
                        from: "training",
                        let: { trainingId: "$trainingId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$_id", "$$trainingId"] } } },
                            { $project: { _id: 0, title: 1, trainingDateTime: 1 } }
                        ],
                        as: "training"
                    }
                },
                { $unwind: "$training" },
                { $sort: { "training.trainingDateTime": -1 } },
                {
                    $project: {
                        title: "$training.title",
                        date: "$training.trainingDateTime"
                    }
                }
            ];

            /* ---------------- TESTIMONIALS PIPELINE ---------------- */

            const testimonialPipeline: any[] = [
                {
                    $match: {
                        createdBy: memberObjectId,
                        isActive: 1,
                        isDelete: 0
                    }
                },
                {
                    $lookup: {
                        from: "member",
                        localField: "createdBy",
                        foreignField: "_id",
                        as: "fromMember"
                    }
                },
                { $unwind: "$fromMember" },
                {
                    $project: {
                        comment: "$comments",
                        rating: "$ratings",
                        createdAt: 1,
                        fromMember: {
                            _id: "$fromMember._id",
                            fullName: "$fromMember.fullName",
                            profileImage: "$fromMember.profileImage",
                            companyName: "$fromMember.companyName"
                        }
                    }
                },
                { $sort: { createdAt: -1 } }
            ];
            const [
                profile,
                communities,
                trainingHistory,
                testimonials
            ] = await Promise.all([
                this.memberRepo.aggregate(profilePipeline).toArray(),
                this.communityRepo.aggregate(communityPipeline).toArray(),
                this.participantRepo.aggregate(trainingPipeline).toArray(),
                this.thankYouRepo.aggregate(testimonialPipeline).toArray()
            ]);

            if (!profile.length) {
                return response(res, 404, "Member not found");
            }

            return response(res, 200, "Profile overview fetched", {
                profile: profile[0],
                communities,
                trainingHistory,
                testimonials
            });

        } catch (error) {
            console.error(error);
            return response(res, 500, "Failed to fetch profile overview");
        }
    }

}
