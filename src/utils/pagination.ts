import { StatusCodes } from "http-status-codes";
import ApiError from "./error";
import handleErrorResponse from "./commonFunction";

interface PaginationResult<T> {
    status: number | string;
    message: string;
    totalCount?: number;
    from?: number;
    to?: number;
    totalPages?: number;
    currentPage?: number;
    data?: T[];
}

function pagination<T>(
    totalCount: number,
    data: T[],
    limit: number,
    currentPage: number,
    res: any,
): PaginationResult<T> | any {
    try {
        const offset = (((+currentPage) + 1) - 1) * limit;
        let from = 0;
        let to = 0;
        if (totalCount > 0) {
            from = +offset + 1;
            if (((+offset) + (+limit)) > totalCount) {
                to = totalCount;
            } else {
                to = +offset + +limit;
            }
        }
        let totalPages = Math.ceil(totalCount / limit);
        return res.send({
            status: StatusCodes.OK,
            message: "Pagination successful",
            from: from,
            to: to,
            total: totalCount > 0 ? totalCount : 0,
            totalPages: totalPages > 0 ? totalPages : 0,
            currentPage: +currentPage + 1,
            data,
        });
    } catch (error) {
        handleErrorResponse(error, res);
    }
}

export default pagination;
