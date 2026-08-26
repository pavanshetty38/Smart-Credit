export const ref = (prefix) => `${prefix}-${Math.random().toString(36).slice(2,10).toUpperCase()}`;

import Notification from './models/Notification.js';

export async function notifyUser(user, title, message, type = 'system', metadata = {}) {
  try {
    const userId = user?._id || user;
    if (!userId) return null;

    return await Notification.create({
      user: userId,
      title,
      message,
      type,
      metadata
    });
  } catch (error) {
    console.error('Notification error:', error);
    return null;
  }
}
