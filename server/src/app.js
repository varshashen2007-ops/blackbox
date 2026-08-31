import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import caseRoutes from './routes/case.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp() {
  const app = express();

  // Security Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.isProduction ? config.corsOrigin : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );

  // Body Parsing Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Auth rate limiting
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later.'
      }
    }
  });

  // Base Health Check
  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'blackbox-backend',
        version: '0.1.0'
      }
    });
  });

  // Mount API Routers
  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/cases', caseRoutes);
  app.use('/api/v1/admin', adminRoutes);

  // 404 Handler for undefined API routes
  app.use('/api/*', (req, res, next) => {
    next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export default createApp();
