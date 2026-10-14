import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  registerDeviceToken,
  removeDeviceToken,
  sendMessageNotification,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.post('/send-message', authorize('admin'), sendMessageNotification);
router.patch('/mark-all-read', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);
router.post('/register-token', registerDeviceToken);
router.post('/remove-token', removeDeviceToken);

export default router;
