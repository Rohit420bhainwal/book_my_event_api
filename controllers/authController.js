import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import nodemailer from "nodemailer";
import twilio from "twilio";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import mongoose from "mongoose";
import {saveFileForUser1}  from "../utils/fileHelper.js";
import Service from "../models/Service.js";
import admin from "../config/firebaseAdmin.js";


// ----------------------------
// Helper functions
// ----------------------------
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// ----------------------------
// Configure nodemailer
// ----------------------------
const sendEmailOtp = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465, // or 587
    secure: true, 
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP code is ${otp}. It will expire in 10 minutes.`,
  });
};

// ----------------------------
// Configure Twilio for SMS
// ----------------------------
const sendSmsOtp = async (phone, otp) => {
  const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: `Your OTP code is ${otp}. It will expire in 10 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });
};


const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Only .jpg, .jpeg, .png, .webp files are allowed!"));
  },
});

const getDeterministicFilename = (userId, originalName) => {
  const hash = crypto.createHash("md5").update(userId + originalName).digest("hex");
  return hash + path.extname(originalName);
};

const saveFileForUser = (userId, buffer, originalName) => {
  const filename = getDeterministicFilename(userId, originalName);
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, buffer);
  return filename;
};

// ----------------------------
// SEND OTP
// ----------------------------
// ----------------------------
// SEND OTP (Clean Registration Version)
// ----------------------------
export const sendOtp = async (req, res) => {
  try {
    const { input, method, phone, password, name } = req.body;

    if (!input || !method) {
      return res.status(400).json({
        success: false,
        message: "Input and method required",
      });
    }

    let user =
      method === "email"
        ? await User.findOne({ email: input })
        : await User.findOne({ phone: input });

    const otp = "123456"; // static for testing
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // -----------------------------------------
    // CASE 1: NEW USER → CREATE BASIC PROFILE ONLY
    // -----------------------------------------
    if (!user) {
      const newUser = new User({
        name: name || "",
        email: method === "email" ? input : undefined,
        phone: method === "phone" ? input : phone,
        password: method === "email" ? await bcrypt.hash(password, 10) : undefined,
        otp,
        otpExpiresAt: otpExpiry,

        // IMPORTANT:
        // Do NOT create providerInfo here
        providerInfo: undefined,
        role: null, // user will choose customer/provider later
      });

      await newUser.save();
    }

    // -----------------------------------------
    // CASE 2: EXISTING USER → UPDATE OTP ONLY
    // (Do NOT touch providerInfo or role)
    // -----------------------------------------
    else {
      user.otp = otp;
      user.otpExpiresAt = otpExpiry;

      // Update password only when registering with email
      if (method === "email" && password) {
        user.password = await bcrypt.hash(password, 10);
      }

      await user.save();
    }

    console.log(`OTP for ${input}: ${otp}`);

    res.json({
      success: true,
      message: `OTP sent to your ${method}`,
    });
  } catch (error) {
    console.error("sendOtp Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ----------------------------
// VERIFY OTP
// ----------------------------
export const verifyOtp = async (req, res) => {
  try {
    const { input, otp, method, password } = req.body;
    if (!input || !otp || !method)
      return res.status(400).json({ success: false, message: "Missing fields" });

    let user;
    if (method === "email") user = await User.findOne({ email: input });
    else if (method === "phone") user = await User.findOne({ phone: input });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.otp !== otp || !user.otpExpiresAt || new Date() > user.otpExpiresAt)
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    if (method === "email" && password) user.password = await bcrypt.hash(password, 10);
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: { id: user._id, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (error) {
    console.error("verifyOtp Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /auth/set-role
export const setRole = async (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role) return res.status(400).json({ success: false, message: "Missing fields" });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  user.role = role;
  await user.save();

  res.json({ success: true, message: "Role updated successfully" });
};

// ----------------------------
// LOGIN
// ----------------------------

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Provide email and password" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔥 Restrict ADMIN login from this API
    if (user.role === "admin") {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // ✅ Existing JWT (unchanged)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 🔐 NEW: Firebase Custom Token
    const firebaseToken = await admin
      .auth()
      .createCustomToken(user._id.toString(), {
        role: user.role,
      });

    res.json({
      message: "Login successful",
      token, // backend JWT
      firebaseToken, // 👈 IMPORTANT (new)
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        city: user.city,
      },
      providerInfo: user.providerInfo,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateFcmToken = async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;

    if (!userId || !fcmToken) {
      return res.status(400).json({
        success: false,
        message: "userId and fcmToken required",
      });
    }

    await User.findByIdAndUpdate(userId, {
      fcmToken,
    });

    res.json({
      success: true,
      message: "FCM token updated",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Provide email and password" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔥 Only ADMIN allowed here
    if (user.role !== "admin") {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Firebase token (optional for admin)
    const firebaseToken = await admin
      .auth()
      .createCustomToken(user._id.toString(), {
        role: user.role,
      });

    res.json({
      message: "Login successful",
      token,
      firebaseToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        city: user.city,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------
// PROVIDER ONBOARDING
// ----------------------------
export const providerSubmitInfo = async (req, res) => {
  try {
    const { userId, businessName, contactPerson, phone, email, address, city, idType } = req.body;

    if (!userId)
      return res.status(400).json({ success: false, message: "User ID is required" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    let images = [];

    // service images
    if (req.files?.images) {
      req.files.images.forEach((file) => {
        const filename = saveFileForUser(userId, file.buffer, file.originalname);
        images.push(filename);
      });
    }

    // government ID
    let govFront = "";
    let govBack = "";

    if (req.files?.govFront) {
      govFront = saveFileForUser(
        userId,
        req.files.govFront[0].buffer,
        req.files.govFront[0].originalname
      );
    }

    if (req.files?.govBack) {
      govBack = saveFileForUser(
        userId,
        req.files.govBack[0].buffer,
        req.files.govBack[0].originalname
      );
    }
    // Update provider info
    user.role = "provider";
    user.providerInfo = {
      businessName,
      contactPerson,
      address,
      city,
      onboardingComplete: true,
      status: "pending",
      services: [],
    };

    // ⭐ SAVE GOVERNMENT ID PROOF HERE
// ⭐ Correct path: providerInfo.governmentIdProof
user.providerInfo.governmentIdProof = {
  idType: idType || "",
  frontImage: govFront || "",
  backImage: govBack || "",
};

user.markModified("providerInfo"); // important for nested sub-doc
await user.save();


    res.json({
      success: true,
      message: "Provider info submitted successfully",
    });
  } catch (error) {
    console.error("providerSubmitInfo Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ----------------------------
// PROVIDER SERVICE MANAGEMENT
// ----------------------------
// ----------------------------
// PROVIDER SERVICE MANAGEMENT (UPDATED WITH IMAGE DELETE SUPPORT)
// ----------------------------



export const providerService = async (req, res) => {
  try {
    const {
      userId,
      action,
      serviceId,
      serviceType,
      selectedServiceId, // <-- master service _id
      filledFields,
      description,
      price
    } = req.body;

    if (!userId || !action)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (!user.providerInfo) user.providerInfo = { services: [] };
    if (!Array.isArray(user.providerInfo.services)) user.providerInfo.services = [];

    // Load master service
    let serviceMaster = null;
    if (action === "add" || action === "edit") {
      serviceMaster = await Service.findById(selectedServiceId);
      if (!serviceMaster)
        return res.status(404).json({ success: false, message: "Invalid service selected" });
    }

    // Uploaded images handling
    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const filename = saveFileForUser1(userId, file.buffer, file.originalname);
        uploadedImages.push(filename);
      });
    }

    if (action === "add") {
      const parsedFields = filledFields ? JSON.parse(filledFields) : {};

      const newService = {
        _id: new mongoose.Types.ObjectId(),
        serviceId: serviceMaster._id,
        selectedServiceId,
        serviceType,
        serviceName: serviceMaster.name,
        filledFields: parsedFields,
        description,
        price,
        images: uploadedImages,
      };

      user.providerInfo.services.push(newService);
    }

    if (action === "edit") {
      const index = user.providerInfo.services.findIndex(
        (s) => s._id.toString() === serviceId
      );
      if (index === -1)
        return res.status(404).json({ success: false, message: "Service not found" });

      const parsedFields = filledFields ? JSON.parse(filledFields) : {};
      let oldImages = req.body.existingImages ? JSON.parse(req.body.existingImages) : [];
      let deletedImages = req.body.deletedImages ? JSON.parse(req.body.deletedImages) : [];

      deletedImages.forEach((img) => {
        const filePath = path.join(uploadDir, img);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });

      const finalImages = [...oldImages, ...uploadedImages];

      user.providerInfo.services[index] = {
        ...user.providerInfo.services[index],
        serviceId: serviceMaster._id,
        selectedServiceId,
        serviceType,
        serviceName: serviceMaster.name,
        filledFields: parsedFields,
        description,
        price,
        images: finalImages,
      };
    }

    if (action === "delete") {
      user.providerInfo.services = user.providerInfo.services.filter(
        (s) => s._id.toString() !== serviceId
      );
    }

    await user.save();

    res.json({ success: true, message: `Service ${action} successful`, providerInfo: user.providerInfo });
  } catch (error) {
    console.error("providerService Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



// ----------------------------
// CHECK PROVIDER STATUS
// ----------------------------
export const checkProviderStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId)
      return res.status(400).json({ success: false, message: "User ID required" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (!user.providerInfo)
      return res.json({ success: true, status: "not_submitted" });

    return res.json({
      success: true,
      status: user.providerInfo.status,
      providerInfo: user.providerInfo,
    });
  } catch (error) {
    console.error("checkProviderStatus Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ----------------------------
// FETCH PROVIDER SERVICES
// ----------------------------
export const getProviderServices = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Ensure providerInfo structure exists
    if (!user.providerInfo || !Array.isArray(user.providerInfo.services)) {
      return res.json({ success: true, services: [] });
    }

    res.json({
      services: user.providerInfo.services,
    });
  } catch (error) {
    console.error("getProviderServices Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch provider services" });
  }
};


// ----------------------------
// CUSTOMER: FETCH SERVICES BY CITY (based on logged-in user)
// ----------------------------
export const getServicesByCity = async (req, res) => {
  try {
    const userId = req.user._id;
  

    const customer = await User.findById(userId);
    if (!customer) return res.status(404).json({ success: false, message: "User not found" });
    if (customer.role !== "customer")
      return res.status(403).json({ success: false, message: "Only customers can access this" });

    const city = customer.city?.trim();
    
    if (!city) return res.status(400).json({ success: false, message: "Customer city not set" });

    const cityRegex = new RegExp(`^${city}$`, "i");

    // ✅ Debug log
    // const allProviders = await User.find({ role: "provider" });
    // console.log(
    //   "All providers data:",
    //   allProviders.map((p) => ({
    //     id: p._id,
    //     rootStatus: p.status,
    //     providerStatus: p.providerInfo?.status,
    //     city: p.providerInfo?.city,
    //   }))
    // );

    // ✅ Flexible query (checks both root and nested status)
    const providers = await User.find({
      role: "provider",
      $or: [{ status: "approved" }, { "providerInfo.status": "approved" }],
      "providerInfo.city": { $regex: cityRegex },
    });

    // console.log(
    //   "Providers found:",
    //   providers.length,
    //   providers.map((p) => p.providerInfo.city)
    // );

    if (providers.length === 0) {
      return res.status(404).json({ success: false, message: "No providers found in your city" });
    }

    const services = [];

    providers.forEach((provider) => {
      const providerServices = (provider.providerInfo.services || []).filter(
        (s) => s.status === "approved" || s.status === "pending"
      );

      providerServices.forEach((service) => {
        services.push({
          providerId: provider._id,
          providerName:provider.name,
          providerEmail:provider.email,
          phone:provider.phone,
          providerImage: provider.profileImage,
          businessName: provider.providerInfo.businessName,
          city: provider.providerInfo.city,
          serviceId: service._id,
          serviceType: service.serviceType,
          description: service.description,
          price: service.price,
          rating: provider.providerInfo.rating.avgRating,
          address: provider.providerInfo.address,
          images: (service.images || []).map(
            (img) => `${req.protocol}://${req.get("host")}/uploads/${img}`
          ),
        });
      });
    });

    res.json({
      city,
      count: services.length,
      services,
    });
  } catch (error) {
    console.error("getServicesByCity Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ----------------------------
// CUSTOMER: UPDATE CITY
// ----------------------------
export const updateCustomerCity = async (req, res) => {
  try {
    const { city } = req.body;

    if (!city || city.trim() === "") {
      return res.status(400).json({ success: false, message: "City is required" });
    }

    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "customer") {
      return res.status(403).json({ success: false, message: "Only customers can update city" });
    }

    user.city = city.trim();
    await user.save();

    res.json({
      success: true,
      message: "City updated successfully",
      user: { id: user._id, city: user.city },
    });
  } catch (error) {
    console.error("updateCustomerCity Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ----------------------------
// CUSTOMER: SEARCH PROVIDERS BY BUSINESS NAME OR SERVICE TYPE
// ----------------------------
export const searchProviders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { query } = req.query; // e.g., /search-providers?query=catering

    if (!query || query.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Search query is required" });
    }

    // ✅ Fetch customer
    const customer = await User.findById(userId);
    if (!customer)
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });

    if (customer.role !== "customer")
      return res
        .status(403)
        .json({ success: false, message: "Only customers can search providers" });

    // ✅ Get customer city
    const city = customer.city?.trim();
    if (!city) {
      return res
        .status(400)
        .json({ success: false, message: "Customer city not set" });
    }

    // ✅ Build search conditions
    const searchRegex = new RegExp(query, "i"); // case-insensitive
    const cityRegex = new RegExp(`^${city}$`, "i");

    // ✅ Find approved providers in same city where businessName OR serviceType matches
    const providers = await User.find({
      role: "provider",
      "providerInfo.status": "approved",
      "providerInfo.city": { $regex: cityRegex },
      $or: [
        { "providerInfo.businessName": { $regex: searchRegex } },
        { "providerInfo.services.serviceType": { $regex: searchRegex } },
      ],
    });

    if (!providers.length) {
      return res.json({
        success: true,
        message: "No matching providers found",
        results: [],
      });
    }

    // ✅ Transform response
    const results = [];

    providers.forEach((provider) => {
      const matchedServices = (provider.providerInfo.services || []).filter((s) =>
        searchRegex.test(s.serviceType)
      );

      results.push({
        providerId: provider._id,
        providerName: provider.name,
        businessName: provider.providerInfo.businessName,
        city: provider.providerInfo.city,
        contactPerson: provider.providerInfo.contactPerson,
        phone: provider.phone,
        email: provider.email,
        services: matchedServices.map((s) => ({
          serviceType: s.serviceType,
          description: s.description,
          price: s.price,
          status: s.status,
          images: (s.images || []).map(
            (img) => `${req.protocol}://${req.get("host")}/uploads/${img}`
          ),
        })),
      });
    });

    res.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("searchProviders Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ----------------------------
// RESET PASSWORD: SEND OTP
// ----------------------------
export const sendResetPasswordOtp = async (req, res) => {
  try {
    // Accept either:
    // { input: "...", method: "email"|"phone" }
    // OR { email: "..." }
    // OR { phone: "..." }
    let { input, method, email, phone } = req.body;

    // normalize inputs
    if (!input) {
      if (email) {
        input = email;
        method = "email";
      } else if (phone) {
        input = phone;
        method = "phone";
      }
    }

    if (!input || !method)
      return res.status(400).json({ success: false, message: "Input & method required" });

    let user;
    if (method === "email") user = await User.findOne({ email: input });
    else if (method === "phone") user = await User.findOne({ phone: input });
    else return res.status(400).json({ success: false, message: "Invalid method" });

    if (!user)
      return res.status(404).json({ success: false, message: "No user found with this email/phone" });

    // generate OTP (for testing you had fixed '123456' — use generateOtp() in prod)
    const otp = generateOtp(); // or "123456" for testing
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.resetOtp = otp;
    user.resetOtpExpiresAt = otpExpiry;
    user.resetOtpVerified = false;
    await user.save();

    // send OTP - uncomment when ready
    // if (method === "email") await sendEmailOtp(input, otp);
    // if (method === "phone") await sendSmsOtp(input, otp);

    console.log(`RESET OTP for ${input} = ${otp}`);

    return res.json({ success: true, message: `Reset OTP sent to your ${method}` });
  } catch (error) {
    console.error("sendResetPasswordOtp Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


// ----------------------------
// RESET PASSWORD: VERIFY OTP
// ----------------------------
export const verifyResetPasswordOtp = async (req, res) => {
  try {
    // Accept either { input, method, otp } OR { email, otp } OR { phone, otp }
    let { input, method, email, phone, otp } = req.body;

    if (!input) {
      if (email) {
        input = email;
        method = "email";
      } else if (phone) {
        input = phone;
        method = "phone";
      }
    }

    if (!input || !otp || !method)
      return res.status(400).json({ success: false, message: "Missing fields" });

    let user;
    if (method === "email") user = await User.findOne({ email: input });
    else user = await User.findOne({ phone: input });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!user.resetOtp || user.resetOtp !== otp || !user.resetOtpExpiresAt || new Date() > user.resetOtpExpiresAt) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    user.resetOtpVerified = true;
    await user.save();

    return res.json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("verifyResetPasswordOtp Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


// ----------------------------
// RESET PASSWORD: SET NEW PASSWORD
// ----------------------------
export const setNewPassword = async (req, res) => {
  try {
    // Accept either { input, method, newPassword } OR { email, newPassword } OR { phone, newPassword }
    let { input, method, email, phone, newPassword } = req.body;

    if (!input) {
      if (email) {
        input = email;
        method = "email";
      } else if (phone) {
        input = phone;
        method = "phone";
      }
    }

    if (!input || !newPassword)
      return res.status(400).json({ success: false, message: "Missing fields" });

    // find user
    let user;
    if (method === "email" || email) user = await User.findOne({ email: input });
    else user = await User.findOne({ phone: input });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!user.resetOtpVerified)
      return res.status(403).json({ success: false, message: "OTP not verified" });

    // update password
    user.password = await bcrypt.hash(newPassword, 10);

    // clear reset fields
    user.resetOtp = undefined;
    user.resetOtpExpiresAt = undefined;
    user.resetOtpVerified = false;

    await user.save();

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("setNewPassword Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};





