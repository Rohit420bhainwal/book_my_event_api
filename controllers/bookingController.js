import Booking from "../models/Booking.js";
import User from "../models/User.js";
import Service from "../models/Service.js";

// Create a new booking (customer only)
export const createBooking = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can create bookings" });
    }

    const { providerId, serviceId, date } = req.body;

    // Validate provider
    const provider = await User.findById(providerId);
    if (!provider || provider.role !== "provider") {
      return res.status(404).json({ message: "Provider not found" });
    }

    // Validate service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    // Convert date string to local start of day
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0); // Start of day local

    const booking = await Booking.create({
      user: req.user._id,
      provider: providerId,
      service: serviceId,
      date: date,
      category: service.category,
    });

    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (error) {
    console.error("Booking Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get bookings of logged-in customer
// Get bookings of logged-in customer
// Get bookings of logged-in customer
export const getMyBookings = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can view their bookings" });
    }

    const bookings = await Booking.find({ user: req.user._id })
      .populate({
        path: "service",
        populate: {
          path: "category", // populate the category reference
          select: "name"    // only return the name field
        }
      })
      .populate("provider", "name email businessName servicesOffered");

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Get Bookings Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


// Get bookings for provider
export const getProviderBookings = async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({ message: "Only providers can view their bookings" });
    }

    const bookings = await Booking.find({ provider: req.user._id })
      .populate("user", "name email phone")
      .populate("service", "name category city price images");

      res.status(200).json(bookings);
    // res.status(200).json({ success: true, data: { bookings } });
  } catch (error) {
    console.error("Get Provider Bookings Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get single booking details
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // Find booking by ID and populate relations
    const booking = await Booking.findById(bookingId)
      .populate({
        path: "service",
        populate: {
          path: "category",
          select: "name"
        }
      })
      .populate("provider", "name email businessName servicesOffered")
      .populate("user", "name email phone");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    res.status(200).json(booking);
  } catch (error) {
    console.error("Get Booking By ID Error:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};


export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body; // "confirmed" or "canceled"

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Only provider can accept or reject
    if (req.user.role !== "provider" || booking.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    booking.status = status;
    await booking.save();

    res.status(200).json({ message: "Booking status updated", booking });
  } catch (error) {
    console.error("Update Booking Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

