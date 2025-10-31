// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import nodemailer from "nodemailer";
import twilio from "twilio";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Helper: generate 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// ----------------------------
// Configure nodemailer
// ----------------------------
const sendEmailOtp = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
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

// ----------------------------
// POST /auth/send-otp
// ----------------------------
export const sendOtp = async (req, res) => {
  try {
    const { input, method, phone,password ,name} = req.body;

    if (!input || !method) return res.status(400).json({ success: false, message: "Input and method are required" });

    let user;
    if (method === "email") user = await User.findOne({ email: input });
    else if (method === "phone") user = await User.findOne({ phone: input });
    else return res.status(400).json({ success: false, message: "Invalid method" });

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (!user) {
      // New user → create temp record with OTP
      const newUser = new User({
        email: method === "email" ? input : undefined,
        phone,
        name,
        password: method === "email" ? await bcrypt.hash(password, 10) : undefined,
        otp,
        otpExpiresAt: otpExpiry,
      });
      await newUser.save();
    } else {
      // Existing user → update OTP
      user.otp = otp;
      user.otpExpiresAt = otpExpiry;
      if (method === "email" && password) user.password = await bcrypt.hash(password, 10);
      await user.save();
    }

    // Send OTP
    if (method === "email") await sendEmailOtp(input, otp);
    else if (method === "phone") await sendSmsOtp(input, otp);
    console.log(`OTP for ${input}: ${otp}`);

    res.json({ success: true, message: `OTP sent to your ${method}` });
  } catch (error) {
    console.error("sendOtp Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ----------------------------
// POST /auth/verify-otp
// ----------------------------
export const verifyOtp = async (req, res) => {
  try {
    const { input, otp, method, password } = req.body;
    if (!input || !otp || !method) return res.status(400).json({ success: false, message: "Missing fields" });

    let user;
    if (method === "email") user = await User.findOne({ email: input });
    else if (method === "phone") user = await User.findOne({ phone: input });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.otp !== otp || !user.otpExpiresAt || new Date() > user.otpExpiresAt)
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

    // OTP verified → mark as verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    if (method === "email" && password) user.password = await bcrypt.hash(password, 10);
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

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
// Social login / email login
// ----------------------------
export const registerSocial = async (req, res) => {
  try {
    const { name, email, phone, provider, socialId } = req.body;
    if (!provider) return res.status(400).json({ message: "Provider type is required" });

    // Social login (Google / Facebook)
    let user = await User.findOne({ socialId, provider });
    if (!user) {
      user = new User({
        name,
        email,
        phone,
        provider,
        socialId,
        role: "customer",
      });
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(200).json({ message: "Login successful", token, user });
  } catch (error) {
    console.error("registerSocial Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ----------------------------
// Traditional login with email & password
// ----------------------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Provide email and password" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, 
              role: user.role ,phone: user.phone,
              profileImage:user.profileImage,city:user.city
      },
      providerInfo:user.providerInfo,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// ----------------------------
// Provider Onboarding
// ----------------------------
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config for multiple images
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

// Deterministic filename
const getDeterministicFilename = (userId, originalName) => {
  const hash = crypto.createHash("md5").update(userId + originalName).digest("hex");
  return hash + path.extname(originalName);
};

const saveFileForUser = (userId, buffer, originalName) => {
  const filename = getDeterministicFilename(userId, originalName);
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, buffer); // overwrite if exists
  return filename;
};

// ----------------------------
// POST /auth/provider-submit-info
// ----------------------------
export const providerSubmitInfo = async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ success: false, message: "User ID is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Extract provider info from request body
    const {
      businessName,
      contactPerson,
      phone,
      email,
      address,
      serviceType,
      description,
      price,
    } = req.body;

    // Handle uploaded images (max 5)
    let images = user.providerInfo?.images || [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const filename = saveFileForUser(userId, file.buffer, file.originalname);
        images.push(filename);
      });
      // Keep last 5 images
      if (images.length > 5) images = images.slice(-5);
    }

    // Update user document
    user.role = "provider"; // ensure role is provider
    user.providerInfo = {
      businessName,
      contactPerson,
      phone,
      email,
      address,
      serviceType,
      description,
      price,
      images,
      onboardingComplete: true,
      status: user.providerInfo?.status || "pending",
    };

    await user.save();

    return res.json({ success: true, message: "Provider info submitted successfully" });
  } catch (error) {
    console.error("providerSubmitInfo Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// GET /auth/check-provider-status/:userId
export const checkProviderStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId)
      return res.status(400).json({ success: false, message: "User ID is required" });

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
