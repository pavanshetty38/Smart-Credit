import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res) => {
  const limit = Math.min(
    Math.max(Number(req.query.limit) || 30, 1),
    100
  );

  const notifications = await Notification.find({
    user: req.user._id
  })
    .sort('-createdAt')
    .limit(limit);

  const unread = await Notification.countDocuments({
    user: req.user._id,
    read: false
  });

  res.json({ notifications, unread });
});

router.patch('/:id/read', async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: { read: true } },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      message: 'Notification not found'
    });
  }

  res.json(notification);
});

router.patch('/read-all', async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, read: false },
    { $set: { read: true } }
  );

  res.json({ message: 'All notifications marked as read' });
});

export default router;
