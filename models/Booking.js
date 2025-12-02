// models/Service.js

// models/Booking.js
import mongoose from "mongoose";
import { type } from "os";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true }, // 👈 linked to Service model
    date: { type: Date, required: true },
    category: { type: String, required: true },
    status: { type: String, enum: ["pending", "confirmed", "canceled"], default: "pending" },
    paymentId:{type:String, default: "" },

      // 🔥 New Commission fields
      bookingAmount: { type: Number, required: true }, 
      commissionType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
      commissionValue: { type: Number, default: 0 },
      commissionAmount: { type: Number, default: 0 },
      providerEarning: { type: Number, default: 0 },

  },
  { timestamps: true }
);

// 🔥 prevent OverwriteModelError
if (mongoose.models.Booking) {
  delete mongoose.models.Booking;
}

export default mongoose.model("Booking", bookingSchema);
