import ApiError from "./error";

function handleErrorResponse(error: any, res: any) {
    if (error instanceof ApiError) {
        res.status(error.statusCode).json(error.toResponse());
    } else {
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
}

export default handleErrorResponse;
