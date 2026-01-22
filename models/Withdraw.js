import mongoose from "mongoose";

const withdrawSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "approved", "failed","rejected"],
      default: "pending",
    },

    upiId: { type: String, required: true },

    payoutId: { type: String }, // Razorpay payout ID
    errorMessage: { type: String }, // Error if payout fails
  },
  { timestamps: true }
);

if (mongoose.models.Withdraw) delete mongoose.models.Withdraw;

export default mongoose.model("Withdraw", withdrawSchema);
