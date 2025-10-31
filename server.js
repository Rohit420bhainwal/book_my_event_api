import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";

dotenv.config();
const app = express();
connectDB();

// ======================
// Emulate __dirname
// ======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================
// Middlewares
// ======================
app.use(cors());
app.use(express.json());

// Serve uploads folder statically
app.use("/uploads", express.static(path.join(__dirname, "./uploads")));

// ======================
// Routes
// ======================
app.use("/api/auth", authRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api", uploadRoutes);
app.use("/api/profile", profileRoutes);

// Test route
app.get("/test", (req, res) => {
  res.send("✅ API is working fine!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
