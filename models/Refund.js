import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      enum: ["pending", "processed", "failed","initiated"],
      default: "pending",
    },

    reason: {
      type: String,
    },

    stripeRefundId: {
      type: String,
    },

    initiatedBy: {
      type: String,
      enum: ["admin", "system","provider"],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Refund", refundSchema);
