import * as authService from '../services/auth.service.js';

export async function register(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const result = await authService.registerUser(req.body, ipAddress);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const result = await authService.loginUser(req.body, ipAddress);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res) {
  res.status(200).json({
    success: true,
    data: {
      user: req.user.toJSON()
    }
  });
}

export async function logout(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    await authService.logoutUser(req.user, ipAddress);
    res.status(200).json({
      success: true,
      data: {
        message: 'Logged out successfully'
      }
    });
  } catch (error) {
    next(error);
  }
}
