import { AppError } from './errorHandler.js';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const dataToValidate = req[source];
      const parsed = schema.parse(dataToValidate);
      req[source] = parsed;
      next();
    } catch (error) {
      if (error.errors) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', details));
      }
      return next(new AppError('Invalid request data', 400, 'VALIDATION_ERROR'));
    }
  };
}
