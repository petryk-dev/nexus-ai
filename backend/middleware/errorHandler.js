/**
 * Wraps an async route handler so rejected promises reach errorHandler
 * instead of crashing the process or hanging the request.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Express error-handling middleware. Must be registered last, after routes.
 */
function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.path}:`, err);

  if (res.headersSent) {
    // A stream was already in progress — end it rather than trying to
    // send a fresh JSON error response.
    res.end();
    return;
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.publicMessage || "Internal server error",
    ...(process.env.NODE_ENV !== "production" ? { detail: err.message } : {}),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found" });
}

module.exports = { asyncHandler, errorHandler, notFoundHandler };
