import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../database/prisma';
import { redis } from '../cache/redis';
import { sendEmail } from '../services/email';
import { sendSMS } from '../services/sms';
import { generateOTP } from '../utils/crypto';
import { config } from '../config';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(['FARMER', 'VERIFIER', 'BUYER']).default('FARMER'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

const verifyOTPSchema = z.object({
  phone: z.string(),
  otp: z.string().length(6),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login endpoint
  fastify.post('/login', {
    schema: {
      body: loginSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, rememberMe } = request.body;

    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { profile: true },
      });

      if (!user) {
        return reply.code(401).send({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect',
        });
      }

      // Check if user is active
      if (user.status !== 'ACTIVE') {
        return reply.code(401).send({
          error: 'Account inactive',
          message: 'Your account is not active. Please contact support.',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return reply.code(401).send({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect',
        });
      }

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: rememberMe ? '30d' : '24h',
      });

      const refreshToken = jwt.sign(
        { userId: user.id },
        config.jwt.refreshSecret,
        { expiresIn: '30d' }
      );

      // Store refresh token in Redis
      await redis.setex(`refresh_token:${user.id}`, 30 * 24 * 60 * 60, refreshToken);

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Create session record
      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000),
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || '',
        },
      });

      // Set secure cookies
      reply.setCookie('accessToken', accessToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          profile: user.profile,
        },
      };
    } catch (error) {
      fastify.log.error('Login error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred during login',
      });
    }
  });

  // Register endpoint
  fastify.post('/register', {
    schema: {
      body: registerSchema,
    },
  }, async (request, reply) => {
    const { firstName, lastName, email, phone, password, role } = request.body;

    try {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase() },
            ...(phone ? [{ phone }] : []),
          ],
        },
      });

      if (existingUser) {
        return reply.code(409).send({
          error: 'User already exists',
          message: 'A user with this email or phone number already exists',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email: email.toLowerCase(),
          phone,
          password: hashedPassword,
          role,
          profile: {
            create: {
              country: 'IN', // Default to India
            },
          },
        },
        include: { profile: true },
      });

      // Send welcome email
      await sendEmail({
        to: user.email,
        template: 'welcome',
        data: {
          firstName: user.firstName,
          loginUrl: `${config.frontend.url}/login`,
        },
      });

      // Send SMS verification if phone provided
      if (phone) {
        const otp = generateOTP();
        await redis.setex(`phone_otp:${phone}`, 300, otp); // 5 minutes

        await sendSMS({
          to: phone,
          message: `Your KrishiMitra verification code is: ${otp}`,
        });
      }

      return reply.code(201).send({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      fastify.log.error('Registration error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred during registration',
      });
    }
  });

  // Forgot password endpoint
  fastify.post('/forgot-password', {
    schema: {
      body: forgotPasswordSchema,
    },
  }, async (request, reply) => {
    const { email } = request.body;

    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        // Don't reveal if user exists
        return reply.send({
          message: 'If an account with this email exists, a reset link has been sent',
        });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { userId: user.id, purpose: 'password_reset' },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // Store reset token in Redis
      await redis.setex(`reset_token:${user.id}`, 3600, resetToken);

      // Send reset email
      await sendEmail({
        to: user.email,
        template: 'password-reset',
        data: {
          firstName: user.firstName,
          resetUrl: `${config.frontend.url}/reset-password?token=${resetToken}`,
        },
      });

      return {
        message: 'If an account with this email exists, a reset link has been sent',
      };
    } catch (error) {
      fastify.log.error('Forgot password error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred while processing your request',
      });
    }
  });

  // Reset password endpoint
  fastify.post('/reset-password', {
    schema: {
      body: resetPasswordSchema,
    },
  }, async (request, reply) => {
    const { token, newPassword } = request.body;

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      if (decoded.purpose !== 'password_reset') {
        return reply.code(400).send({
          error: 'Invalid token',
          message: 'The reset token is invalid',
        });
      }

      // Check if token exists in Redis
      const storedToken = await redis.get(`reset_token:${decoded.userId}`);
      if (!storedToken || storedToken !== token) {
        return reply.code(400).send({
          error: 'Invalid or expired token',
          message: 'The reset token is invalid or has expired',
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

      // Update password
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { password: hashedPassword },
      });

      // Remove reset token
      await redis.del(`reset_token:${decoded.userId}`);

      // Invalidate all existing sessions
      await prisma.userSession.deleteMany({
        where: { userId: decoded.userId },
      });

      return {
        message: 'Password reset successfully',
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return reply.code(400).send({
          error: 'Invalid token',
          message: 'The reset token is invalid or has expired',
        });
      }

      fastify.log.error('Reset password error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred while resetting your password',
      });
    }
  });

  // Verify phone OTP
  fastify.post('/verify-phone', {
    schema: {
      body: verifyOTPSchema,
    },
  }, async (request, reply) => {
    const { phone, otp } = request.body;

    try {
      // Get stored OTP
      const storedOTP = await redis.get(`phone_otp:${phone}`);
      
      if (!storedOTP || storedOTP !== otp) {
        return reply.code(400).send({
          error: 'Invalid OTP',
          message: 'The OTP is invalid or has expired',
        });
      }

      // Update user phone verification status
      await prisma.user.updateMany({
        where: { phone },
        data: { phoneVerified: true },
      });

      // Remove OTP
      await redis.del(`phone_otp:${phone}`);

      return {
        message: 'Phone number verified successfully',
      };
    } catch (error) {
      fastify.log.error('Phone verification error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred during phone verification',
      });
    }
  });

  // Logout endpoint
  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const token = request.headers.authorization?.split(' ')[1];

      // Remove session from database
      await prisma.userSession.deleteMany({
        where: {
          userId,
          token,
        },
      });

      // Remove refresh token from Redis
      await redis.del(`refresh_token:${userId}`);

      // Clear cookies
      reply.clearCookie('accessToken');
      reply.clearCookie('refreshToken');

      return {
        message: 'Logged out successfully',
      };
    } catch (error) {
      fastify.log.error('Logout error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred during logout',
      });
    }
  });

  // Refresh token endpoint
  fastify.post('/refresh', async (request, reply) => {
    try {
      const refreshToken = request.cookies.refreshToken || request.body.refreshToken;

      if (!refreshToken) {
        return reply.code(401).send({
          error: 'No refresh token',
          message: 'Refresh token is required',
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
      
      // Check if token exists in Redis
      const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        return reply.code(401).send({
          error: 'Invalid refresh token',
          message: 'The refresh token is invalid or has expired',
        });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.status !== 'ACTIVE') {
        return reply.code(401).send({
          error: 'User not found or inactive',
          message: 'The user associated with this token is not found or inactive',
        });
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        config.jwt.secret,
        { expiresIn: '24h' }
      );

      // Set new cookie
      reply.setCookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return {
        token: newAccessToken,
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return reply.code(401).send({
          error: 'Invalid refresh token',
          message: 'The refresh token is invalid or has expired',
        });
      }

      fastify.log.error('Refresh token error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred while refreshing the token',
      });
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        include: {
          profile: true,
          farms: {
            select: {
              id: true,
              name: true,
              area: true,
              status: true,
            },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({
          error: 'User not found',
          message: 'The user associated with this token was not found',
        });
      }

      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
      };
    } catch (error) {
      fastify.log.error('Get current user error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'An error occurred while fetching user data',
      });
    }
  });
}
