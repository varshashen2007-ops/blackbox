/**
 * NoSQL Injection Protection Middleware
 * Recursively inspects and cleans input objects in req.body, req.query, and req.params.
 * Removes keys starting with $ or containing . to prevent NoSQL query operator injection.
 */

function containsForbiddenOperator(obj) {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      return true;
    }
    if (typeof obj[key] === 'object' && containsForbiddenOperator(obj[key])) {
      return true;
    }
  }

  return false;
}

function cleanObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => cleanObject(item));
  }

  const cleaned = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    const val = cleanObject(obj[key]);
    // Avoid leaving empty operator objects
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) {
      continue;
    }
    cleaned[key] = val;
  }

  return cleaned;
}

export function sanitizeNoSqlInjection(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      if (containsForbiddenOperator(req.body)) {
        req.body = cleanObject(req.body);
      }
    }

    if (req.query && typeof req.query === 'object') {
      if (containsForbiddenOperator(req.query)) {
        req.query = cleanObject(req.query);
      }
    }

    if (req.params && typeof req.params === 'object') {
      if (containsForbiddenOperator(req.params)) {
        req.params = cleanObject(req.params);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
