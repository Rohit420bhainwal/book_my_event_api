import express from "express";
import { sendMessageNotification } from "../controllers/sendPushNotification.js";

const router = express.Router();

// Route to send message notification
router.post("/send-message-notification", async (req, res) => {
  const { senderId, receiverId,serviceId ,serviceName,message } = req.body;

  try {
    await sendMessageNotification(senderId, receiverId, serviceId,serviceName,message);
    res.status(200).json({ success: true, message: "Notification sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
