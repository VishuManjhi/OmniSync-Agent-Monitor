/**
 * Global Error Handler Middleware
 * Catches all errors and returns a consistent JSON response.
 */
const errorHandler = (err, req, res, next) => {
    console.error('[SYSTEM ERROR]', err);

    const status = err.status || err.statusCode || 500;
    const message = err.message || 'INTERNAL_SERVER_ERROR';
    const code = err.code || err.name || message || 'UNKNOWN_ERROR';

    res.status(status).json({
        error: code,
        message: message,
        timestamp: new Date().toISOString()
    });
};

export default errorHandler;
