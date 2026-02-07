import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
    statusCode?: number;
    details?: any;
}

export function errorHandler(
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.error("Error:", err);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        ...(err.details && { details: err.details }),
    });
}

export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({ error: "Route not found" });
}
