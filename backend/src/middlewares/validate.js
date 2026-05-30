/**
 * Zod Validation Middleware
 * Validates req.body, req.query, and req.params against Zod schemas
 * Security: Prevents malformed data and injection attacks
 * 
 * Note: In Express 5, req.query and req.params may be read-only.
 * Parsed values are stored in req.validated.query and req.validated.params
 * Controllers should use req.validated for transformed values (e.g., string-to-number)
 */
export const validate = (schemas) => (req, res, next) => {
  try {
    // Initialize validated object to store parsed data
    req.validated = req.validated || {};

    // Validate each part of the request if schema is provided
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    
    if (schemas.query) {
      // Parse query and store in req.validated.query
      req.validated.query = schemas.query.parse(req.query);
    }
    
    if (schemas.params) {
      // Parse params and store in req.validated.params
      req.validated.params = schemas.params.parse(req.params);
    }
    
    next();
  } catch (error) {
    // Format Zod errors for client
    const formattedErrors = error.errors?.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    })) || [{ message: error.message }];

    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: formattedErrors,
    });
  }
};