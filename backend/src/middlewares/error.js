export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error for internal tracking (exclude sensitive data)
  console.error(`[Error] ${req.method} ${req.url}:`, err);

  res.status(statusCode).json({
    success: false,
    message,
    // Hide stack trace in production
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};