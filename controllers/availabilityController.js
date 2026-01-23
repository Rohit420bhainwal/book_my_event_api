import AvailabilityConfig from "../models/AvailabilityConfig.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

// Helper: convert a Date to IST day string "YYYY-MM-DD"
const toISTDateStr = (date) => {
  const istOffset = 5.5 * 60; // 5.5 hours in minutes
  const utc = date.getTime() + date.getTimezoneOffset() * 60000; // UTC timestamp
  const ist = new Date(utc + istOffset * 60000);
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// GET monthly availability (fixed for IST)
export const getMonthlyAvailability = async (req, res) => {
  try {
    const { serviceId, month } = req.query;

    if (!serviceId || !month) {
      return res.status(400).json({
        success: false,
        message: "serviceId and month are required",
      });
    }

    // STEP 1: Find provider
    const provider = await User.findOne({
      role: "provider",
      "providerInfo.services._id": serviceId,
    });
    if (!provider) return res.status(404).json({ success: false, message: "Provider not found" });

    const providerId = provider._id;

    // STEP 2: Fetch availability config
    const config = await AvailabilityConfig.findOne({ providerId, serviceId });
  

    if (!config) return res.status(404).json({ success: false, message: "Availability not configured" });

    // STEP 3: Month boundaries in IST
    const [year, monthNum] = month.split("-").map(Number);
    const startIST = new Date(year, monthNum - 1, 1); // 1st of month
    const endIST = new Date(year, monthNum, 1);       // 1st of next month

    // STEP 4: Fetch bookings (confirmed + pending)
    // Adjust start and end to UTC before querying DB
    const startUTC = new Date(startIST.getTime() - 5.5 * 60 * 60 * 1000);
    const endUTC = new Date(endIST.getTime() - 5.5 * 60 * 60 * 1000);

    const bookings = await Booking.find({
        provider: providerId, // matches Booking schema
        service: serviceId,   // matches Booking schema
        date: { $gte: startUTC, $lt: endUTC },
        status: { $in: ["confirmed", "pending"] },
      }).select("date");
      

    console.log("bookings: "+bookings);

    // STEP 5: Map bookings to IST day strings
    const bookedDates = new Set(bookings.map(b => toISTDateStr(new Date(b.date))));

    // STEP 6: Build calendar in IST
    const days = {};
    for (let d = new Date(startIST); d < endIST; d.setDate(d.getDate() + 1)) {
      const dateStr = toISTDateStr(d);
      const dayOfWeek = d.getDay(); // IST day of week

      if (!config.workingDays.includes(dayOfWeek)) {
        days[dateStr] = "UNAVAILABLE";
      } else if (bookedDates.has(dateStr)) {
        days[dateStr] = "FULL";
      } else {
        days[dateStr] = "AVAILABLE";
      }
    }

    return res.json({ month, days });

  } catch (error) {
    console.error("Monthly availability error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
