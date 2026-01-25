import admin from "../services/firebase.js";
import User from "../models/User.js";

// Assuming you track 'activeChatWith' in MongoDB inside User or a separate collection
export const sendMessageNotification = async (senderId, receiverId, message) => {
  const receiver = await User.findById(receiverId);

  if (!receiver) return;

  // 🛑 If receiver is chatting with sender → DON'T send notification
  if (receiver.activeChatWith === senderId) {
    console.log("Chat open. Skipping push notification");
    return;
  }

  if (!receiver.fcmToken) return;

  // ✅ DATA ONLY MESSAGE
  await admin.messaging().send({
    token: receiver.fcmToken,
    data: {
      type: "chat",
      senderId,
      receiverId,
      message,
    },
  });

  console.log("Data notification sent");
};
