import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true }, // e.g., "commission"
  commissionType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
  commissionValue: { type: Number, default: 10 }
});

export default mongoose.model("Settings", settingsSchema);
