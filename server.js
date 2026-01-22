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

import withdrawRoutes from "./routes/withdrawRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

import paymentRoutes from "./routes/stripePaymentRoutes.js";
import providerStripeRoutes from "./routes/providerStripeRoutes.js";
import bodyParser from "body-parser";
import stripeWebhookRoutes from "./routes/stripeWebhookRoutes.js";
import "./cron/autoCancelBookings.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import availabilityRoutes from "./routes/availabilityRoutes.js";
import providerAvailabilityRoutes from "./routes/providerAvailabilityRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";





//dotenv.config();
dotenv.config({ path: path.resolve("./.env") });
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
app.use("/api/withdraw", withdrawRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/provider/stripe", providerStripeRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/availability",availabilityRoutes);
app.use("/api/provider", providerAvailabilityRoutes);
app.use("/api", notificationRoutes);


// Test route
app.get("/test", (req, res) => {
  res.send("✅ API is working fine!");
});

app.use("/api/stripe", stripeWebhookRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
