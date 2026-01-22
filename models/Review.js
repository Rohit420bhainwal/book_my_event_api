import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true, // 🔒 one review per booking
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

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    comment: {
      type: String,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: ["active", "hidden", "reported"],
      default: "active",
    },

    // 🔥 SNAPSHOT (IMMUTABLE)
    providerSnapshot: {
      businessName: String,
    },

    serviceSnapshot: {
      name: String,
      category: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);
