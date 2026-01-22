import Service from "../models/Service.js";

export const getServicesForCustomer = async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) {
      return res.status(400).json({ success: false, message: "City is required" });
    }

    // Fetch services for the city
    const services = await Service.find({ city: city }).populate("category", "name").populate("provider", "name email phone");

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Error fetching customer services:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};
