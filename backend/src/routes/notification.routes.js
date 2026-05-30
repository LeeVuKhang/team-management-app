import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { z } from 'zod';
import db from '../utils/db.js';

/**
 * User Notification Routes
 * 
 * These are USER-facing endpoints (require JWT auth)
 * for viewing and managing their notifications.
 * 
 * Different from /api/internal/* which are for n8n server-to-server calls.
 */

const router = express.Router();

// Apply JWT auth to all routes
router.use(verifyToken);

// ============================================
// VALIDATION SCHEMAS
// ============================================

const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    unreadOnly: z.string().optional().transform(v => v === 'true'),
  }),
});

const markReadSchema = z.object({
  body: z.object({
    notificationIds: z.array(z.number().int().positive()).optional().nullable(),
  }),
});

// ============================================
// ROUTES
// ============================================

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's notifications (paginated)
 * @access  Private (JWT)
 */
router.get('/', validate(getNotificationsSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit, unreadOnly } = req.query;
    const offset = (page - 1) * limit;

    // Build query based on filters
    let notifications;
    let total;

    if (unreadOnly) {
      notifications = await db`
        SELECT * FROM notifications 
        WHERE user_id = ${userId} AND is_read = FALSE
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      [{ count: total }] = await db`
        SELECT COUNT(*) FROM notifications 
        WHERE user_id = ${userId} AND is_read = FALSE
      `;
    } else {
      notifications = await db`
        SELECT * FROM notifications 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      [{ count: total }] = await db`
        SELECT COUNT(*) FROM notifications 
        WHERE user_id = ${userId}
      `;
    }

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total: parseInt(total, 10),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private (JWT)
 */
router.get('/unread-count', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [{ count }] = await db`
      SELECT COUNT(*) FROM notifications 
      WHERE user_id = ${userId} AND is_read = FALSE
    `;

    res.json({
      success: true,
      data: { count: parseInt(count, 10) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/notifications/read
 * @desc    Mark notifications as read
 * @access  Private (JWT)
 */
router.post('/read', validate(markReadSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { notificationIds } = req.body;

    let updated;

    if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      updated = await db`
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW()
        WHERE user_id = ${userId} AND id = ANY(${notificationIds})
        RETURNING id
      `;
    } else {
      // Mark all as read
      updated = await db`
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW()
        WHERE user_id = ${userId} AND is_read = FALSE
        RETURNING id
      `;
    }

    res.json({
      success: true,
      data: { markedRead: updated.length },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete a notification
 * @access  Private (JWT)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.id, 10);

    // SECURITY: Only allow deleting own notifications
    const deleted = await db`
      DELETE FROM notifications 
      WHERE id = ${notificationId} AND user_id = ${userId}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/notifications
 * @desc    Delete all notifications for user
 * @access  Private (JWT)
 */
router.delete('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const deleted = await db`
      DELETE FROM notifications 
      WHERE user_id = ${userId}
      RETURNING id
    `;

    res.json({
      success: true,
      data: { deleted: deleted.length },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
