// // models/User.js
// import mongoose from "mongoose";

// const userSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true, lowercase: true, trim: true },
//     phone: { type: String, required: true },
//     password: { type: String, required: true },
//     role: { type: String, enum: ["customer", "provider","admin"], required: true },
//     city: { type: String, required: true }, // required for both customer and provider
//     isVerified: { type: Boolean, default: false }, // optional
//     profileImage: { type: String, default: "" },
//   },
//   { timestamps: true }
// );

// export default mongoose.model("User", userSchema);


// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" }, // optional now
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String },
    role: { type: String, enum: ["customer", "provider","admin"],  default: null },
    city: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    profileImage: { type: String, default: "" },
    otp: { type: String }, // for storing OTP temporarily
    otpExpiresAt: { type: Date }, // OTP expiry
    
    resetOtp: { type: String },
    resetOtpExpiresAt: { type: Date },
    resetOtpVerified: { type: Boolean, default: false },
     // **Provider-specific info**
     providerInfo: {
      businessName: { type: String, default: "" },
      contactPerson: { type: String, default: "" },
      // phone: { type: String, default: "" },
      // email: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      //serviceType: { type: String, default: "" },
    //  description: { type: String, default: "" },
    //  price: { type: String, default: "" },
    //  images: { type: [String], default: [] },

    services: [
      {
        serviceType: { type: String, default: "" },
        description: { type: String, default: "" },
        price: { type: String, default: "" },
        images: { type: [String], default: [] },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      },
    ],
      onboardingComplete: { type: Boolean, default: false },
      status: { type: String, enum: ["pending", "approved", "rejected","suspended"], default: "pending"},
      
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
