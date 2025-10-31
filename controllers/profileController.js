import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

// ======================
// Get Profile
// ======================
export const getProfile = async (req, res) => {
  try {
    const user = req.user; // already fetched in middleware
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ======================
// Update Profile
// ======================
export const updateProfile = async (req, res) => {
  try {
    const updates = req.body;

    // Only allow certain fields
    const allowedFields = ["name", "phone", "profileImage", "city"];
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        req.user[field] = updates[field]; // directly update req.user
      }
    });

    await req.user.save(); // save the changes

    res.json({ success: true, message: "Profile updated", user: req.user });
  } catch (err) {
    console.error("❌ Error updating profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

