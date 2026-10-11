import { Router } from 'express';
import {
  registerDeviceToken,
  removeDeviceToken,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.post('/register-token', registerDeviceToken);
router.post('/remove-token', removeDeviceToken);

export default router;
