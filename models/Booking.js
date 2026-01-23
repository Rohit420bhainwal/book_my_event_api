import mongoose from "mongoose";



const bookingSchema = new mongoose.Schema(
  {
    // ======================
    // BASIC RELATIONS
    // ======================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    slot: {
      type: String, // "10:00-12:00"
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    // ======================
    // BOOKING STATUS
    // ======================
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },

    // ======================
    // PAYMENT STATUS
    // ======================
    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "advance_paid",
        "fully_paid",
        "overdue",
        "refunded",
      ],
      default: "pending",
    },

    // ======================
    // PAYMENT AMOUNTS
    // ======================
    totalAmount: {
      type: Number,
      required: true,
    },

    advanceAmount: {
      type: Number,
      required: true,
    },

    paidAmount: {
      type: Number,
      default: 0,
    },

    remainingAmount: {
      type: Number,
      default: 0,
    },

    // ======================
    // STRIPE PAYMENT IDS
    // ======================
    advancePaymentId: {
      type: String,
      default: "",
    },

    remainingPaymentId: {
      type: String,
      default: "",
    },

    // ======================
    // PAYMENT DEADLINE
    // ======================
    paymentDeadline: {
      type: Date,
    },

    autoCancelled: {
      type: Boolean,
      default: false,
    },

    // ======================
    // COMMISSION & PAYOUT
    // ======================
    commissionType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },

    commissionValue: {
      type: Number,
      default: 0,
    },

    commissionAmount: {
      type: Number,
      default: 0,
    },

    providerEarning: {
      type: Number,
      default: 0,
    },

    bookingType: {
      type: String,
      enum: ["regular", "urgent"],
      required: true,
    },

    payoutStatus: {
      type: String,
      enum: [
        "pending",
        "available",
        "requested",
        "processing",
        "paid",
        "rejected",
        "cancelled",
      ],
      default: "pending",
    },

    payoutReleaseDate: {
      type: Date,
    },

    payoutId: {
      type: String,
    },

    providerResponseDeadline: {
      type: Date,
      required: true,
    },

    cancelReason: {
      type: String,
    },

    refundStatus: {
      type: String,
      enum: ["none", "initiated", "refunded", "failed"],
      default: "none",
    },

    refundId: {
      type: String,
    },

    // ======================
    // SERVICE COMPLETION
    // ======================
    completedAt: {
      type: Date,
    },

    // ======================
    // REVIEW & RATING
    // ======================
    // reviewStatus: {
    //   type: String,
    //   enum: ["not_eligible", "pending", "reviewed"],
    //   default: "not_eligible",
    // },

    reviewStatus: {
      type: String,
      enum: ["pending", "submitted"],
      default: "pending",
    },

    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
    },
  },
  { timestamps: true }
);

// 🔥 Prevent OverwriteModelError
if (mongoose.models.Booking) {
  delete mongoose.models.Booking;
}

export default mongoose.model("Booking", bookingSchema);
