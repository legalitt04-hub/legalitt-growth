const Notification = require('../models/Notification');
const User = require('../models/User');
const axios = require('axios');
const logger = require('./logger');
const { getPlatformSettings } = require('../middlewares/platformSettings');

/**
 * Creates a notification in the database and triggers an Expo push notification if the user has a push token registered.
 */
exports.createNotification = async ({ recipientId, senderId, title, message, type, relatedId }) => {
  try {
    // 1. Save to Database
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      title,
      message,
      type: type || 'general',
      relatedId,
    });

    // 2. Fetch recipient user details (specifically the push token)
    const recipient = await User.findById(recipientId).select('expoPushToken fcmToken preferences');
    
    // Check if notifications are disabled in user preferences
    if (recipient?.preferences?.notifications === false) {
      logger.info(`Notifications are disabled in preferences for user: ${recipientId}`);
      return notification;
    }

    const settings = await getPlatformSettings();
    const expoToken = settings.features?.pushEnabled === false ? null : (recipient?.expoPushToken || recipient?.fcmToken);

    // 3. Trigger Push Notification if token exists
    if (expoToken && (expoToken.startsWith('ExponentPushToken') || expoToken.length > 10)) {
      logger.info(`Sending Push Notification to token: ${expoToken}`);
      try {
        await axios.post('https://exp.host/--/api/v2/push/send', {
          to: expoToken,
          sound: 'default',
          title: title,
          body: message,
          data: { type, relatedId: relatedId?.toString() },
          priority: 'high',
          badge: 1,
        }, {
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        });
        logger.info(`Push notification dispatched successfully to ${expoToken}`);
      } catch (pushErr) {
        logger.error(`Failed to dispatch push notification: ${pushErr.message}`);
      }
    }

    return notification;
  } catch (error) {
    logger.error(`Error in createNotification helper: ${error.message}`);
  }
};
