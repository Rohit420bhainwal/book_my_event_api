import admin from "../services/firebase.js";
import User from "../models/User.js";

/**
 * Send push notification for chat message
 * @param {string} senderId - ID of the user sending the message
 * @param {string} receiverId - ID of the user receiving the message
 * @param {string} message - Message text
 */
export const sendMessageNotification = async (senderId, receiverId, message) => {
  if (!senderId || !receiverId || !message) {
    throw new Error("Missing required fields: senderId, receiverId, message");
  }

  // 1️⃣ Get sender and receiver
  const sender = await User.findById(senderId);
  const receiver = await User.findById(receiverId);

  if (!sender || !receiver) {
    throw new Error("Sender or receiver not found");
  }

  const token = receiver.fcmToken;
  if (!token) {
    // Optional: log, but don’t fail
    console.log(`Receiver ${receiverId} has no FCM token`);
    return;
  }

  // 2️⃣ Send push notification
  await admin.messaging().send({
    token,
    notification: {
      title: `New message from ${sender.name || "User"}`,
      body: message,
    },
    data: {
      senderId,
      receiverId,
      type: "chat",
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
  });

  console.log(`Notification sent to ${receiverId}`);
};
