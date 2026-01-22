// controllers/providerController.js
import User from "../models/User.js";

// Get logged-in provider profile
export const getProviderProfile = async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "provider") {
    return res.status(403).json({ message: "Access denied" });
  }
  res.status(200).json(user);
};

// Update provider profile
export const updateProviderProfile = async (req, res) => {
  const user = req.user;
  if (!user || user.role !== "provider") {
    return res.status(403).json({ message: "Access denied" });
  }

  const { businessName, servicesOffered } = req.body;

  if (businessName) user.businessName = businessName;
  if (servicesOffered) user.servicesOffered = servicesOffered;

  await user.save();
  res.status(200).json({ message: "Profile updated", user });
};

