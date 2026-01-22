import {
    Post,
    Body,
    Req,
    Res,
    UseBefore,
    JsonController,
    Put,
    Param,
    Get,
    Delete
} from "routing-controllers";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { AppDataSource } from "../../data-source";
import { Order } from "../../entity/Order";
import { CreateOrderDto } from "../../dto/admin/Order.dto";
import { handleErrorResponse, pagination, response } from "../../utils";

interface RequestWithUser extends Request {
    query: any;
    user: AuthPayload;
}

@UseBefore(AuthMiddleware)
@JsonController("/orders")
export class OrderController {

    private orderRepository = AppDataSource.getMongoRepository(Order);

    // --------------------------------------------------
    // CREATE ORDER
    // --------------------------------------------------
    @Post("/create")
    async createOrder(
        @Req() req: RequestWithUser,
        @Body() body: CreateOrderDto,
        @Res() res: Response
    ) {
        try {

            const order = new Order();

            order.zoneId = new ObjectId(body.zoneId);
            order.regionId = new ObjectId(body.regionId);
            order.chapterId = new ObjectId(body.chapterId);
            order.memberId = new ObjectId(body.memberId);
            order.productId = new ObjectId(body.productId);

            order.isActive = 1;
            order.isDelete = 0;
            order.createdBy = new ObjectId(req.user.userId);
            order.createdAt = new Date();

            await this.orderRepository.save(order);

            return response(
                res,
                StatusCodes.CREATED,
                "Order created successfully",
                order
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }

    // --------------------------------------------------
    // EDIT ORDER
    // --------------------------------------------------
    @Put("/edit/:id")
    async editOrder(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Body() body: CreateOrderDto,
        @Res() res: Response
    ) {
        try {

            if (!ObjectId.isValid(id)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid order id");
            }

            const order = await this.orderRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!order) {
                return response(res, StatusCodes.NOT_FOUND, "Order not found");
            }

            if (body.zoneId) order.zoneId = new ObjectId(body.zoneId);
            if (body.regionId) order.regionId = new ObjectId(body.regionId);
            if (body.chapterId) order.chapterId = new ObjectId(body.chapterId);
            if (body.memberId) order.memberId = new ObjectId(body.memberId);
            if (body.productId) order.productId = new ObjectId(body.productId);

            order.updatedBy = new ObjectId(req.user.userId);
            order.updatedAt = new Date();

            await this.orderRepository.save(order);

            return response(
                res,
                StatusCodes.OK,
                "Order updated successfully",
                order
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }

    // --------------------------------------------------
    // LIST ORDERS
    // --------------------------------------------------
    @Get("/list")
    async listOrders(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);

            const zoneId = req.query.zoneId?.toString();
            const regionId = req.query.regionId?.toString();
            const chapterId = req.query.chapterId?.toString();
            const memberId = req.query.memberId?.toString();

            const match: any = { isDelete: 0 };

            if (zoneId) match.zoneId = new ObjectId(zoneId);
            if (regionId) match.regionId = new ObjectId(regionId);
            if (chapterId) match.chapterId = new ObjectId(chapterId);
            if (memberId) match.memberId = new ObjectId(memberId);

            const pipeline = [
                { $match: match },

                // -------------------------
                // LOOKUPS
                // -------------------------
                {
                    $lookup: {
                        from: "zones",
                        localField: "zoneId",
                        foreignField: "_id",
                        as: "zone"
                    }
                },
                { $unwind: { path: "$zone", preserveNullAndEmptyArrays: true } },

                {
                    $lookup: {
                        from: "regions",
                        localField: "regionId",
                        foreignField: "_id",
                        as: "region"
                    }
                },
                { $unwind: { path: "$region", preserveNullAndEmptyArrays: true } },

                {
                    $lookup: {
                        from: "chapters",
                        localField: "chapterId",
                        foreignField: "_id",
                        as: "chapter"
                    }
                },
                { $unwind: { path: "$chapter", preserveNullAndEmptyArrays: true } },

                {
                    $lookup: {
                        from: "members",
                        localField: "memberId",
                        foreignField: "_id",
                        as: "member"
                    }
                },
                { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },

                {
                    $lookup: {
                        from: "products",
                        localField: "productId",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

                // -------------------------
                // SHAPE RESPONSE FOR UI
                // -------------------------
                {
                    $project: {
                        _id: 1,
                        orderId: "$_id",
                        zoneName: "$zone.name",
                        regionName: "$region.name",
                        chapterName: "$chapter.name",
                        memberName: "$member.fullName",
                        productName: "$product.productName",
                        createdAt: 1
                    }
                },

                { $sort: { createdAt: -1 } },

                // -------------------------
                // PAGINATION
                // -------------------------
                {
                    $facet: {
                        data: [
                            { $skip: page * limit },
                            { $limit: limit }
                        ],
                        meta: [{ $count: "total" }]
                    }
                }
            ];

            const result = await this.orderRepository.aggregate(pipeline).toArray();

            const data = result[0]?.data || [];
            const total = result[0]?.meta[0]?.total || 0;

            return pagination(total, data, limit, page, res);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }


    // --------------------------------------------------
    // ORDER DETAILS
    // --------------------------------------------------
    @Get("/details/:id")
    async orderDetails(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid order id");
            }

            const pipeline = [
                {
                    $match: {
                        _id: new ObjectId(id),
                        isDelete: 0
                    }
                },
                {
                    $project: {
                        isDelete: 0
                    }
                }
            ];

            const result = await this.orderRepository
                .aggregate(pipeline)
                .toArray();

            if (!result.length) {
                return response(res, StatusCodes.NOT_FOUND, "Order not found");
            }

            return response(
                res,
                StatusCodes.OK,
                "Order details fetched successfully",
                result[0]
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }

    // --------------------------------------------------
    // DELETE ORDER (SOFT DELETE)
    // --------------------------------------------------
    @Delete("/delete/:id")
    async deleteOrder(
        @Param("id") id: string,
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(res, StatusCodes.BAD_REQUEST, "Invalid order id");
            }

            const order = await this.orderRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!order) {
                return response(res, StatusCodes.NOT_FOUND, "Order not found");
            }

            order.isDelete = 1;
            order.updatedAt = new Date();
            order.updatedBy = new ObjectId(req.user.userId);

            await this.orderRepository.save(order);

            return response(
                res,
                StatusCodes.OK,
                "Order deleted successfully"
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }
    @Get("/order-list")
    async listOrder(
        @Req() req: RequestWithUser,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);
            const search = req.query.search?.toString();

            const match: any = { isDelete: 0 };

            if (search) {
                match.orderNumber = { $regex: search, $options: "i" };
            }

            const pipeline = [
                { $match: match },

                // MEMBER LOOKUP
                {
                    $lookup: {
                        from: "members",
                        localField: "memberId",
                        foreignField: "_id",
                        as: "member"
                    }
                },
                {
                    $unwind: {
                        path: "$member",
                        preserveNullAndEmptyArrays: true // ✅ FIX
                    }
                },

                // PRODUCT LOOKUP
                {
                    $lookup: {
                        from: "products",
                        localField: "productId",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                {
                    $unwind: {
                        path: "$product",
                        preserveNullAndEmptyArrays: true // ✅ FIX
                    }
                },

                // FORMAT DATA FOR UI
                {
                    $project: {
                        orderNumber: 1,
                        memberName: { $ifNull: ["$member.fullName", ""] },
                        productName: { $ifNull: ["$product.productName", ""] },
                        quantity: { $ifNull: ["$quantity", 1] },
                        amount: { $ifNull: ["$product.price", 0] },
                        orderDate: "$createdAt",
                        status: { $ifNull: ["$status", "Pending"] }
                    }
                },

                { $sort: { orderDate: -1 } },

                {
                    $facet: {
                        data: [
                            { $skip: page * limit },
                            { $limit: limit }
                        ],
                        meta: [{ $count: "total" }]
                    }
                }
            ];

            const result = await this.orderRepository.aggregate(pipeline).toArray();

            // ✅ ALWAYS SAFE
            const data = result[0]?.data ?? [];
            const total = result[0]?.meta?.[0]?.total ?? 0;

            return pagination(total, data, limit, page, res);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

}
