import Booking from "../models/Booking.js";
import User from "../models/User.js";

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

    // Find service inside providerInfo.services
    const service = provider.providerInfo?.services?.find(
      (s) => s._id.toString() === serviceId
    );
    if (!service) {
      return res.status(404).json({ message: "Service not found for this provider" });
    }

    // Convert date string to start of day
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const booking = await Booking.create({
      user: req.user._id,
      provider: providerId,
      service: serviceId,
      date: bookingDate,
      category: service.serviceType,
    });

    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (error) {
    console.error("Booking Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get bookings of logged-in customer
export const getMyBookings = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can view their bookings" });
    }

    const bookings = await Booking.find({ user: req.user._id });

    // Populate provider, service, and user info manually
    const detailedBookings = await Promise.all(
      bookings.map(async (booking) => {
        // Fetch provider
        const provider = await User.findById(booking.provider);

        // Fetch user
        const user = await User.findById(booking.user);

        // Find the service inside providerInfo.services
        const service = provider.providerInfo?.services?.find(
          (s) => s._id.toString() === booking.service.toString()
        );

        // Only select required fields and map images to full URLs
        const serviceData = service
          ? {
              serviceId: service._id,
              serviceType: service.serviceType,
              price: service.price,
              status: service.status,
              description: service.description,
              images: (service.images || []).map(
                (img) => `${req.protocol}://${req.get("host")}/uploads/${img}`
              ),
            }
          : {};

        return {
          _id: booking._id,
          date: booking.date,
          status: booking.status,
          user: user
            ? {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
              }
            : null,
          provider: provider
            ? {
                _id: provider._id,
                name: provider.name,
                email: provider.email,
                businessName: provider.providerInfo?.businessName || "",
                profileImage: provider.profileImage
                  ? `${req.protocol}://${req.get("host")}/uploads/${provider.profileImage}`
                  : null,
              }
            : null,
          service: serviceData,
        };
      })
    );

    res.status(200).json(detailedBookings);
  } catch (error) {
    console.error("Get My Bookings Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


// Get bookings for provider
export const getProviderBookings = async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({ message: "Only providers can view their bookings" });
    }

    const bookings = await Booking.find({ provider: req.user._id });
  // Fetch user
 
  
    const detailedBookings = bookings.map((booking) => {
      const service = req.user.providerInfo?.services?.find(
        (s) => s._id.toString() === booking.service.toString()
      );

      return {
        ...booking._doc,
        user: booking.user, // assuming populated with name/email/phone if needed
        service: service || {},
      };
    });

    res.status(200).json(detailedBookings);
  } catch (error) {
    console.error("Get Provider Bookings Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get single booking details
export const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    const user = await User.findById(booking.user);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const provider = await User.findById(booking.provider);
    const service = provider.providerInfo?.services?.find(
      (s) => s._id.toString() === booking.service.toString()
    );

    res.status(200).json({
      ...booking._doc,
      provider: {
        _id: provider._id,
        name: provider.name,
        email: provider.email,
        businessName: provider.providerInfo?.businessName || "",
      },
      user: user
      ? {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        }
      : null,
      service: service || {},
    });
  } catch (error) {
    console.error("Get Booking By ID Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Update booking status
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
