import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },

    phone: { type: String, unique: true, sparse: true },

    password: { type: String },

    role: { type: String, enum: ["customer", "provider", "admin"], default: null },

    city: { type: String, default: "" },

    isVerified: { type: Boolean, default: false },

    profileImage: { type: String, default: "" },

    fcmToken: {
      type: String,
      default: "",
      index: true,
    },

    otp: { type: String },
    otpExpiresAt: { type: Date },

    resetOtp: { type: String },
    resetOtpExpiresAt: { type: Date },
    resetOtpVerified: { type: Boolean, default: false },

    // -------------------------
    // PROVIDER INFO (ALWAYS CREATED BUT EMPTY)
    // -------------------------
    providerInfo: {
      businessName: { type: String, default: "" },
      contactPerson: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
    
      stripeAccountId: { type: String, default: "" },
      stripeOnboardingCompleted: { type: Boolean, default: false },
    
      governmentIdProof: {
        idType: {
          type: String,
          enum: ["", "aadhaar", "pan", "license", "voterId", "other"],
          default: "",
        },
        frontImage: { type: String, default: "" },
        backImage: { type: String, default: "" },
      },
    
      services: {
        type: [
          {
            selectedServiceId: { type: String, default: "" },
            serviceType: { type: String, default: "" },
            description: { type: String, default: "" },
            filledFields: { type: Object, default: {} },
            price: { type: String, default: "" },
            images: { type: [String], default: [] },
            status: {
              type: String,
              enum: ["pending", "approved", "rejected"],
              default: "pending",
            },
          },
        ],
        default: [],
      },
    
      // ==========================
      // RATINGS & REVIEWS
      // ==========================
      rating: {
        avgRating: {
          type: Number,
          default: 0,
        },
        ratingCount: {
          type: Number,
          default: 0,
        },
        ratingDistribution: {
          1: { type: Number, default: 0 },
          2: { type: Number, default: 0 },
          3: { type: Number, default: 0 },
          4: { type: Number, default: 0 },
          5: { type: Number, default: 0 },
        },
      },
    
      onboardingComplete: { type: Boolean, default: false },
    
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "suspended"],
        default: "pending",
      },
    },
    
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
