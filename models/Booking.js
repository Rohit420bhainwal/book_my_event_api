// models/Service.js

// models/Booking.js
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true }, // 👈 linked to Service model
    date: { type: Date, required: true },
    category: { type: String, required: true },
    status: { type: String, enum: ["pending", "confirmed", "canceled"], default: "pending" },
  },
  { timestamps: true }
);

// 🔥 prevent OverwriteModelError
if (mongoose.models.Booking) {
  delete mongoose.models.Booking;
}

export default mongoose.model("Booking", bookingSchema);
