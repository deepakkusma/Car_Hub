export function errorHandler(err, req, res, next) {
    console.error("Error:", err);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        ...(err.details && { details: err.details }),
    });
}
export function notFoundHandler(req, res) {
    res.status(404).json({ error: "Route not found" });
}
