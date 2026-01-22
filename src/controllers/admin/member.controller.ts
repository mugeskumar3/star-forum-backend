import { Body, Delete, Get, JsonController, Param, Patch, Post, Req, Res, UseBefore } from "routing-controllers";
import { CreateMemberDto, UpdateMemberDto } from "../../dto/admin/Member.dto";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { AppDataSource } from "../../data-source";
import { Member } from "../../entity/Member";
import { StatusCodes } from "http-status-codes";
import response from "../../utils/response";
import { ObjectId } from "mongodb";
import { ApiError, handleErrorResponse, pagination } from "../../utils";
interface RequestWithUser extends Request {
    query: any;
    files(files: any): unknown;
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/member")
export class MemberController {
    private memberRepository = AppDataSource.getMongoRepository(Member);

    @Post('/create')
    async createMember(
        @Body() body: CreateMemberDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            console.log(req.files, 'aa');

            // -------------------------
            // CHECK EXISTING MEMBER
            // -------------------------
            const exists = await this.memberRepository.findOneBy({
                email: body.email,
                isDelete: 0
            });

            if (exists) {
                return response(
                    res,
                    StatusCodes.CONFLICT,
                    "Member already exists"
                );
            }

            // -------------------------
            // CREATE MEMBER OBJECT
            // -------------------------
            const memberData = new Member();

            memberData.profileImage = body.profileImage || undefined;
            memberData.fullName = body.fullName;
            memberData.mobileNumber = body.mobileNumber;
            memberData.email = body.email;
            memberData.companyName = body.companyName;
            memberData.membershipId = body.membershipId;

            memberData.region = new ObjectId(body.region);
            memberData.chapter = new ObjectId(body.chapter);
            memberData.businessCategory = new ObjectId(body.businessCategory);
            memberData.referredBy = new ObjectId(body.referredBy);

            memberData.position = body.position;
            memberData.dateOfBirth = body.dateOfBirth;
            memberData.anniversary = body.anniversary;
            memberData.isActive = 1;
            memberData.isDelete = 0;

            // -------------------------
            // OFFICE ADDRESS
            // -------------------------
            memberData.officeAddress = {
                doorNo: body.officeAddress.doorNo,
                oldNo: body.officeAddress.oldNo,
                street: body.officeAddress.street,
                area: body.officeAddress.area,
                city: body.officeAddress.city,
                state: body.officeAddress.state,
                pincode: body.officeAddress.pincode,
            };

            memberData.isWantSmsEmailUpdates = body.isWantSmsEmailUpdates ?? false;

            // -------------------------
            // SUBSCRIPTION DETAILS
            // -------------------------
            memberData.annualFee = body.annualFee;
            memberData.paymentMode = body.paymentMode;
            memberData.transactionId = body.transactionId;
            memberData.paymentDate = body.paymentDate;
            memberData.joiningDate = body.joiningDate;
            memberData.renewalDate = body.renewalDate;
            memberData.gstNumber = body.gstNumber;
            memberData.sendWelcomeSms = body.sendWelcomeSms ?? false;

            // -------------------------
            // TRAINING REPORT
            // -------------------------
            memberData.trainingYear = body.trainingYear;
            memberData.trainingTypes = body.trainingTypes;
            memberData.trainings = body.trainings;

            // -------------------------
            // AWARDS REPORT
            // -------------------------
            memberData.tenure = body.tenure;
            memberData.awardSelected = body.awardSelected;
            memberData.awards = body.awards;

            // -------------------------
            // CLUB MEMBER
            // -------------------------
            memberData.clubMemberType = body.clubMemberType;

            // -------------------------
            // META FIELDS
            // -------------------------
            memberData.createdBy = new ObjectId(req.user.userId);
            memberData.updatedBy = new ObjectId(req.user.userId);

            // -------------------------
            // SAVE MEMBER
            // -------------------------
            const result = await this.memberRepository.save(memberData);

            return response(
                res,
                StatusCodes.CREATED,
                "Member created successfully",
                result
            );

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    @Patch('/update/:id')
    async updateMember(
        @Param('id') id: string,
        @Body() body: UpdateMemberDto,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            // -----------------------------------------------------
            // CHECK IF MEMBER EXISTS
            // -----------------------------------------------------
            const member = await this.memberRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!member) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Member not found"
                );
            }

            // -----------------------------------------------------
            // CHECK FOR EMAIL DUPLICATE (IF EMAIL IS PROVIDED)
            // -----------------------------------------------------
            if (body.email) {
                const emailExists = await this.memberRepository.findOneBy({
                    email: body.email,
                    isDelete: 0,
                    _id: { $ne: new ObjectId(id) }
                });

                if (emailExists) {
                    return response(
                        res,
                        StatusCodes.CONFLICT,
                        "Email already exists"
                    );
                }
            }

            // -----------------------------------------------------
            // UPDATE BASIC FIELDS
            // -----------------------------------------------------
            const updatableFields = [
                "profileImage",
                "fullName",
                "mobileNumber",
                "email",
                "companyName",
                "membershipId",
                "position",
                "dateOfBirth",
                "anniversary",
                "annualFee",
                "paymentMode",
                "transactionId",
                "paymentDate",
                "joiningDate",
                "renewalDate",
                "gstNumber",
                "sendWelcomeSms",
                "trainingYear",
                "trainingTypes",
                "trainings",
                "tenure",
                "awardSelected",
                "awards",
                "clubMemberType",
                "isWantSmsEmailUpdates"
            ];

            updatableFields.forEach(field => {
                if (body[field] !== undefined) {
                    member[field] = body[field];
                }
            });

            // -----------------------------------------------------
            // UPDATE OBJECT-ID FIELDS
            // -----------------------------------------------------
            if (body.region) member.region = new ObjectId(body.region);
            if (body.chapter) member.chapter = new ObjectId(body.chapter);
            if (body.businessCategory) member.businessCategory = new ObjectId(body.businessCategory);
            if (body.referredBy) member.referredBy = new ObjectId(body.referredBy);

            // -----------------------------------------------------
            // UPDATE NESTED OFFICE ADDRESS
            // -----------------------------------------------------
            if (body.officeAddress) {
                member.officeAddress = {
                    ...member.officeAddress,   // keep existing values
                    ...body.officeAddress      // overwrite provided ones
                };
            }

            // -----------------------------------------------------
            // META FIELDS
            // -----------------------------------------------------
            member.updatedBy = new ObjectId(req.user.userId);

            // -----------------------------------------------------
            // SAVE UPDATE
            // -----------------------------------------------------
            const result = await this.memberRepository.save(member);

            return response(
                res,
                StatusCodes.OK,
                "Member updated successfully",
                result
            );

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    @Get("/list")
    async listMembers(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);
            const search = req.query.search?.toString();
            const region = req.query.region?.toString();
            const chapter = req.query.chapter?.toString();

            // -----------------------------------------------------
            // MATCH STAGE
            // -----------------------------------------------------
            const match: any = { isDelete: 0 };

            if (search) {
                match.$or = [
                    { fullName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { mobileNumber: { $regex: search, $options: "i" } }
                ];
            }

            if (region) match.region = new ObjectId(region);
            if (chapter) match.chapter = new ObjectId(chapter);

            // -----------------------------------------------------
            // AGGREGATION PIPELINE
            // -----------------------------------------------------
            const pipeline = [
                { $match: match },
                { $sort: { createdAt: -1 } },

                {
                    $facet: {
                        data: [
                            { $skip: page * limit },
                            { $limit: limit }
                        ],
                        meta: [
                            { $count: "total" }
                        ]
                    }
                }
            ];

            const result = await this.memberRepository.aggregate(pipeline).toArray();

            const data = result[0]?.data || [];
            const total = result[0]?.meta[0]?.total || 0;

            return pagination(total, data, limit, page, res);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    @Get("/details/:id")
    async memberDetails(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Member Id')
            }

            const pipeline = [
                {
                    $match: {
                        _id: new ObjectId(id),
                        isDelete: 0
                    }
                },

                // ----------------------------
                // OPTIONAL LOOKUPS (future)
                // ----------------------------
                // {
                //   $lookup: {
                //     from: "regions",
                //     localField: "region",
                //     foreignField: "_id",
                //     as: "regionDetails"
                //   }
                // },
                // { $unwind: { path: "$regionDetails", preserveNullAndEmptyArrays: true } },

                {
                    $project: {
                        isDelete: 0
                    }
                }
            ];

            const result = await this.memberRepository
                .aggregate(pipeline)
                .toArray();

            if (!result.length) {
                return response(res, StatusCodes.BAD_REQUEST, 'Member not found!!');
            }

            return response(res, StatusCodes.OK, 'Member got successfully', result[0]);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
    @Delete("/delete/:id")
    async deleteMember(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid Member Id')

            }

            const result = await this.memberRepository.findOne({
                where: {
                    _id: new ObjectId(id),
                    isDelete: 0
                }
            });

            if (!result) {
                return response(res, StatusCodes.OK, 'Member got successfully', result[0]);
            }

            await this.memberRepository.update(
                { id: new ObjectId(id) },
                {
                    isDelete: 1,
                    updatedAt: new Date(),
                    updatedBy: req.user?.userId
                }
            );

            return response(res, StatusCodes.OK, 'Member deleted successfully');

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }
}