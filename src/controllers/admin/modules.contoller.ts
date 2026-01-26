import { Get, JsonController, Req, Res, UseBefore } from "routing-controllers";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { AppDataSource } from "../../data-source";
import { ObjectId } from "mongodb";
import { handleErrorResponse, pagination } from "../../utils";
import { Modules } from "../../entity/Modules";
interface RequestWithUser extends Request {
    query: any;
    files(files: any): unknown;
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/modules")
export class ModulesController {
    private memberRepository = AppDataSource.getMongoRepository(Modules);


    @Get("/list")
    async listModules(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);
            const search = req.query.search?.toString();


            // -----------------------------------------------------
            // MATCH STAGE
            // -----------------------------------------------------
            const match: any = { isDelete: 0 };

            if (search) {
                match.$or = [
                    { name: { $regex: search, $options: "i" } },
                ];
            }


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
}