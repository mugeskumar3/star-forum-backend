import { Post, Body, Req, Res, UseBefore, JsonController, Put, Param, Get, Delete } from "routing-controllers";
import { ObjectId } from "mongodb";
import { StatusCodes } from "http-status-codes";
import path from "path";
import { AuthMiddleware, AuthPayload } from "../../middlewares/AuthMiddleware";
import { AppDataSource } from "../../data-source";
import { Product } from "../../entity/Product";
import { CreateProductDto, UpdateProductDto } from "../../dto/admin/product.dto";
import { handleErrorResponse, pagination, response } from "../../utils";
interface RequestWithFiles extends Request {
    query: any;
    files(files: any): unknown;
    user: AuthPayload;
}
@UseBefore(AuthMiddleware)
@JsonController("/products")
export class ProductController {
    private productRepository = AppDataSource.getMongoRepository(Product);

    @Post("/create")
    async createProduct(
        @Req() req: RequestWithFiles,
        @Body() body: CreateProductDto,

        @Res() res: Response
    ) {
        try {

            const exists = await this.productRepository.findOneBy({
                productName: body.productName,
                isDelete: 0
            });

            if (exists) {
                return response(
                    res,
                    StatusCodes.CONFLICT,
                    "Product already exists"
                );
            }

            const product = new Product();

            product.productName = body.productName;
            product.price = Number(body.price);
            product.categoryId = new ObjectId(body.categoryId);
            product.productImage = body.productImage;
            product.description = body.description || "";

            product.isActive = 1;
            product.isDelete = 0;

            product.createdBy = new ObjectId(req.user.userId);
            product.createdAt = new Date();
            await this.productRepository.save(product);
            return response(res, StatusCodes.CREATED, "Product created successfully", product);

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }
    @Put("/edit/:id")
    async editProduct(
        @Param("id") id: string,
        @Req() req: RequestWithFiles,
        @Body() body: UpdateProductDto,
        @Res() res: Response
    ) {
        try {

            // ----------------------------
            // Validate ObjectId
            // ----------------------------
            if (!ObjectId.isValid(id)) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid product id"
                );
            }

            // ----------------------------
            // Find product
            // ----------------------------
            const product = await this.productRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!product) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Product not found"
                );
            }

            // ----------------------------
            // Check duplicate name (optional)
            // ----------------------------
            if (body.productName) {
                const exists = await this.productRepository.findOneBy({
                    productName: body.productName,
                    isDelete: 0
                });

                if (exists && exists.id.toString() !== id) {
                    return response(
                        res,
                        StatusCodes.CONFLICT,
                        "Product name already exists"
                    );
                }
            }

            // ----------------------------
            // Update fields (only if provided)
            // ----------------------------
            if (body.productName) product.productName = body.productName;
            if (body.price !== undefined) product.price = Number(body.price);
            if (body.categoryId) product.categoryId = new ObjectId(body.categoryId);
            if (body.productImage) product.productImage = body.productImage;
            if (body.description !== undefined) product.description = body.description;
            if (body.isActive !== undefined) product.isActive = body.isActive ? 1 : 0;

            // ----------------------------
            // Audit
            // ----------------------------
            product.updatedBy = new ObjectId(req.user.userId);
            product.updatedAt = new Date();

            await this.productRepository.save(product);

            return response(
                res,
                StatusCodes.OK,
                "Product updated successfully",
                product
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }
    @Get("/list")
    async listProducts(
        @Req() req: RequestWithFiles,
        @Res() res: Response
    ) {
        try {
            const page = Math.max(Number(req.query.page) || 0, 0);
            const limit = Math.max(Number(req.query.limit) || 10, 1);

            const search = req.query.search?.toString();
            const categoryId = req.query.categoryId?.toString();
            const isActive = req.query.isActive;

            const match: any = { isDelete: 0 };

            if (search) {
                match.$or = [
                    { productName: { $regex: search, $options: "i" } }
                ];
            }

            if (categoryId) match.categoryId = new ObjectId(categoryId);
            if (isActive !== undefined) match.isActive = Number(isActive);

            const pipeline = [
                { $match: match },
                { $sort: { createdAt: -1 } },

                {
                    $lookup: {
                        from: "Productcategories",
                        let: { categoryId: "$categoryId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$_id", "$$categoryId"] }
                                }
                            },
                            {
                                $project: {
                                    _id: 0,
                                    name: 1
                                }
                            }
                        ],
                        as: "category"
                    }
                },
                {
                    $unwind: {
                        path: "$category",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $facet: {
                        data: [
                            { $skip: page * limit },
                            { $limit: limit },
                            {
                                $project: {
                                    productName: 1,
                                    price: 1,
                                    description: 1,
                                    productImage: 1,
                                    isActive: 1,
                                    createdAt: 1,
                                    categoryId: 1,
                                    categoryName: "$category.name"
                                }
                            }
                        ],
                        meta: [{ $count: "total" }]
                    }
                }
            ];

            const result = await this.productRepository
                .aggregate(pipeline)
                .toArray();

            const data = result[0]?.data || [];
            const total = result[0]?.meta[0]?.total || 0;

            return pagination(total, data, limit, page, res);

        } catch (error) {
            return handleErrorResponse(error, res);
        }
    }

    @Get("/details/:id")
    async productDetails(
        @Param("id") id: string,
        @Req() req: RequestWithFiles,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid product id"
                );
            }

            const pipeline = [
                {
                    $match: {
                        _id: new ObjectId(id),
                        isDelete: 0
                    }
                },

                // OPTIONAL: populate category
                // {
                //   $lookup: {
                //     from: "categories",
                //     localField: "categoryId",
                //     foreignField: "_id",
                //     as: "category"
                //   }
                // },
                // {
                //   $unwind: {
                //     path: "$category",
                //     preserveNullAndEmptyArrays: true
                //   }
                // }

                {
                    $project: {
                        isDelete: 0
                    }
                }
            ];

            const result = await this.productRepository
                .aggregate(pipeline)
                .toArray();

            if (!result.length) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Product not found"
                );
            }

            return response(
                res,
                StatusCodes.OK,
                "Product details fetched successfully",
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
    @Delete("/delete/:id")
    async deleteProduct(
        @Param("id") id: string,
        @Req() req: RequestWithFiles,
        @Res() res: Response
    ) {
        try {
            if (!ObjectId.isValid(id)) {
                return response(
                    res,
                    StatusCodes.BAD_REQUEST,
                    "Invalid product id"
                );
            }

            const product = await this.productRepository.findOneBy({
                _id: new ObjectId(id),
                isDelete: 0
            });

            if (!product) {
                return response(
                    res,
                    StatusCodes.NOT_FOUND,
                    "Product not found"
                );
            }

            product.isDelete = 1;
            product.updatedAt = new Date();
            product.updatedBy = new ObjectId(req.user.userId);

            await this.productRepository.save(product);

            return response(
                res,
                StatusCodes.OK,
                "Product deleted successfully"
            );

        } catch (error: any) {
            return response(
                res,
                StatusCodes.INTERNAL_SERVER_ERROR,
                error.message || "Something went wrong"
            );
        }
    }
}