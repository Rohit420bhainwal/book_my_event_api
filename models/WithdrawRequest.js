import mongoose from "mongoose";

const withdrawRequestSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "failed"],
      default: "pending",
    },

    stripeTransferId: { type: String },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("WithdrawRequest", withdrawRequestSchema);
