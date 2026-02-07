import { Request, Response, NextFunction } from "express";
export interface ApiError extends Error {
    statusCode?: number;
    details?: any;
}
export declare function errorHandler(err: ApiError, req: Request, res: Response, next: NextFunction): void;
export declare function notFoundHandler(req: Request, res: Response): void;
