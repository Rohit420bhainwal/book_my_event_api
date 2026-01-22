import AvailabilityConfig from "../models/AvailabilityConfig.js";
import User from "../models/User.js";

/**
 * CREATE or UPDATE availability config
 * Provider only
 */
export const upsertAvailabilityConfig = async (req, res) => {
    try {
      const { serviceId, workingDays, slots } = req.body;
  
      if (!serviceId || !workingDays || !slots) {
        return res.status(400).json({
          message: "serviceId, workingDays and slots are required",
        });
      }
  
      const provider = await User.findById(req.user._id);
      if (!provider || provider.role !== "provider") {
        return res.status(403).json({
          message: "Only providers can manage availability",
        });
      }
  
      const service = provider.providerInfo.services.find(
        (s) => s._id.toString() === serviceId
      );
  
      if (!service) {
        return res.status(404).json({
          message: "Service not found under this provider",
        });
      }
  
      const config = await AvailabilityConfig.findOneAndUpdate(
        {
          providerId: provider._id,
          serviceId,
        },
        {
          providerId: provider._id,
          serviceId,
          workingDays,
          slots,
        },
        {
          new: true,
          upsert: true,
        }
      );
  
      return res.status(200).json({
        message: "Availability configuration saved successfully",
        config,
      });
  
    } catch (error) {
      console.error("Availability upsert error:", error);
      res.status(500).json({ message: "Server error" });
    }
  };
  

/**
 * GET availability config (for edit screen)
 */
export const getAvailabilityConfigByService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const config = await AvailabilityConfig.findOne({ serviceId });

    if (!config) {
      return res.status(404).json({
        message: "Availability config not found",
      });
    }

    return res.json(config);
  } catch (error) {
    console.error("Get availability config error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
