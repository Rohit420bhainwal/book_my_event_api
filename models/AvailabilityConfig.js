import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    start: { type: String, required: true }, // "10:00"
    end: { type: String, required: true },   // "12:00"
    capacity: { type: Number, required: true, min: 1 }
  },
  { _id: false }
);

const availabilityConfigSchema = new mongoose.Schema(
  {
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true
    },

    workingDays: {
      type: [Number], // 0 = Sunday ... 6 = Saturday
      required: true
    },

    slots: {
      type: [slotSchema],
      required: true
    }
  },
  { timestamps: true }
);

export default mongoose.model(
  "AvailabilityConfig",
  availabilityConfigSchema
);
