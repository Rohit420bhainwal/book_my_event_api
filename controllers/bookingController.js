import Booking from "../models/Booking.js";
import User from "../models/User.js";
import Settings from "../models/Settings.js"; 
import stripe from "../utils/stripe.js";
import Withdraw from "../models/WithdrawRequest.js";
//import Withdraw from "../models/Withdraw.js";
import Refund from "../models/Refund.js";



// Create a new booking (customer only)

export const createPaymentIntent = async (req, res) => {
  try {
    const {
      providerId,
      serviceId,
      date,
      amount,
      currency,
    } = req.body;

    

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const provider = await User.findById(providerId);
    if (!provider || provider.role !== "provider") {
      return res.status(404).json({ message: "Provider not found" });
    }

    
    // const service = provider.providerInfo?.services?.find((s) => s._id.toString() === serviceId);
    // if (!service) {
    //   return res.status(404).json({ message: "Service not found" });
    // }

        // Find selected service from providerInfo.services
        const service = provider.providerInfo?.services?.find(
          (s) => s._id.toString() === serviceId
        );
        if (!service) {
          return res.status(404).json({ message: "Service not found for this provider" });
        }

const ALLOWED_CURRENCIES = ["inr", "usd", "aed"];

if (!ALLOWED_CURRENCIES.includes(currency)) {
  return res.status(400).json({
    message: "Unsupported currency",
    received: currency,
  });
}


    const settings = await Settings.findOne({ key: "commission" });
    const commissionType = settings?.commissionType || "percentage";
    const commissionValue = settings?.commissionValue || 15;

    let commissionAmount = 0;
    if (commissionType === "percentage") {
      commissionAmount = (amount * commissionValue) / 100;
    } else {
      commissionAmount = commissionValue;
    }


    const providerEarning = amount - commissionAmount;

    const bookingDate = new Date(date);
   // bookingDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (bookingDate - today) / (1000 * 60 * 60 * 24)
    );

    const bookingType = diffDays <= 2 ? "urgent" : "regular";

    let payoutReleaseDate;
    let payoutStatus = "pending";
    
    if (bookingType === "urgent") {
      //payoutReleaseDate = today;
      payoutReleaseDate = new Date(); // exact current UTC time

      payoutStatus = "available";
    } else {
      //payoutReleaseDate = new Date(bookingDate);
      //payoutReleaseDate.setDate(payoutReleaseDate.getDate() - 1);
      payoutReleaseDate = new Date(bookingDate.getTime() - 24 * 60 * 60 * 1000);

    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: { enabled: true },
      // application_fee_amount: Math.round(commissionAmount * 100),

      // transfer_data: {
      //   destination: provider.providerInfo.stripeAccountId,
      // },
     
      metadata: {
        source: "flutter_app",
        providerId,
        serviceId,
        bookingType,
        commissionAmount,
        commissionType,
        providerEarning,
        payoutReleaseDate: payoutReleaseDate.toISOString(),
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      bookingAmount: amount,
      commissionAmount,
      providerEarning,
      bookingType,
      payoutReleaseDate,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const confirmBooking = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can create bookings" });
    }
    const { providerId, serviceId, date, paymentIntentId, userId } = req.body;
  

    // Verify PaymentIntent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded")
      return res.status(400).json({ message: "Payment not successful" });

  
    const provider = await User.findById(providerId);
    if (!provider || provider.role !== "provider") {
      return res.status(404).json({ message: "Provider not found" });
    }

      // Extract metadata
        // Find selected service from providerInfo.services
        const service = provider.providerInfo?.services?.find(
          (s) => s._id.toString() === serviceId
        );
        if (!service) {
          return res.status(404).json({ message: "Service not found for this provider" });
        }

            // 👉 Step 1: Load app commission settings
    const settings = await Settings.findOne({ key: "commission" });
    // const commissionType = settings?.commissionType || "percentage";
    // const commissionValue = settings?.commissionValue || 10;

    const bookingAmount = service.price;
  

    // 👉 Step 2: Calculate commission
  

    const {
      bookingType,
      // commissionAmount,
      commissionType,
      // providerEarning,
      // payoutReleaseDate,
    } = paymentIntent.metadata;
  
    const payoutReleaseDate = new Date(paymentIntent.metadata.payoutReleaseDate);
const commissionAmount = Number(paymentIntent.metadata.commissionAmount);
const providerEarning = Number(paymentIntent.metadata.providerEarning);


    // Create booking
    const booking = await Booking.create({
      user: req.user._id,
      provider: providerId,
      service: serviceId,
      date: new Date(date),
      category: service.serviceType,
      paymentId: paymentIntent.id,
      bookingAmount: paymentIntent.amount / 100,
      commissionType: paymentIntent.commissionType,
      commissionValue: (commissionAmount / (paymentIntent.amount / 100)) * 100,
      commissionAmount,
      providerEarning,
      bookingType,
      payoutReleaseDate: new Date(payoutReleaseDate),
      payoutStatus: bookingType === "urgent" ? "available" : "pending",
    });

    res.status(201).json({ message: "Booking confirmed", booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};



export const createBooking = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can create bookings" });
    }

    const { providerId, serviceId, date, paymentId } = req.body;

    // Validate provider
    const provider = await User.findById(providerId);
    if (!provider || provider.role !== "provider") {
      return res.status(404).json({ message: "Provider not found" });
    }

    // Find selected service from providerInfo.services
    const service = provider.providerInfo?.services?.find(
      (s) => s._id.toString() === serviceId
    );
    if (!service) {
      return res.status(404).json({ message: "Service not found for this provider" });
    }

    // 👉 Step 1: Load app commission settings
    const settings = await Settings.findOne({ key: "commission" });
    const commissionType = settings?.commissionType || "percentage";
    const commissionValue = settings?.commissionValue || 15;

    const bookingAmount = service.price;
    let commissionAmount = 0;

    // 👉 Step 2: Calculate commission
    if (commissionType === "percentage") {
      commissionAmount = (bookingAmount * commissionValue) / 100;
    } else if (commissionType === "fixed") {
      commissionAmount = commissionValue;
    }

    // 👉 Step 3: Provider earning
    const providerEarning = bookingAmount - commissionAmount;

    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
today.setHours(0, 0, 0, 0);

const diffDays = Math.ceil(
  (bookingDate - today) / (1000 * 60 * 60 * 24)
);

const bookingType = diffDays <= 2 ? "urgent" : "regular";

let payoutReleaseDate;
let payoutStatus = "pending";

if (bookingType === "urgent") {
  payoutReleaseDate = today;
  payoutStatus = "available";
} else {
  payoutReleaseDate = new Date(bookingDate);
  payoutReleaseDate.setDate(payoutReleaseDate.getDate() - 1);
}

const booking = await Booking.create({
  user: req.user._id,
  provider: providerId,
  service: serviceId,
  date: bookingDate,
  category: service.serviceType,
  paymentId,

  bookingAmount,
  commissionType,
  commissionValue,
  commissionAmount,
  providerEarning,

  bookingType,
  payoutReleaseDate,
  payoutStatus,
});


    res.status(201).json({
      message: "Booking created with commission applied",
      booking,
    });
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
        city: provider.providerInfo.city||"",
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

export const getAllBookingsForAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can view all bookings" });
    }

    // 👉 Sort latest bookings first
    const bookings = await Booking.find({}).sort({ createdAt: -1 });

    const detailedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const user = await User.findById(booking.user);
        const provider = await User.findById(booking.provider);

        const service = provider?.providerInfo?.services?.find(
          (s) => s._id.toString() === booking.service.toString()
        );

        return {
          _id: booking._id,
          date: booking.date,
          status: booking.status,
          bookingAmount: booking.bookingAmount,
          commissionAmount: booking.commissionAmount,
          providerEarning: booking.providerEarning,
          paymentId: booking.paymentId,

          user: user
            ? { _id: user._id, name: user.name, email: user.email, phone: user.phone }
            : null,

          provider: provider
            ? {
                _id: provider._id,
                name: provider.name,
                email: provider.email,
                phone: provider.phone,
                businessName: provider.providerInfo?.businessName || "",
                profileImage: provider.profileImage
                  ? `${req.protocol}://${req.get("host")}/uploads/${provider.profileImage}`
                  : null,
              }
            : null,

          service: service
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
            : {},
        };
      })
    );

    res.status(200).json(detailedBookings);
  } catch (error) {
    console.error("Admin Get All Bookings Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const requestWithdraw = async (req, res) => {
  try {
    const providerId = req.user._id; // from JWT
    const { bookingId, upiId } = req.body;

    // 1️⃣ Validate input
    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID is required" });
    }

    if (!upiId) {
      return res.status(400).json({ message: "UPI ID is required" });
    }

    // 2️⃣ Fetch booking
    const booking = await Booking.findOne({
      _id: bookingId,
      provider: providerId,
      status: "confirmed",
      payoutStatus: "available",
    });

    console.log("booking: "+booking);

    if (!booking) {
      return res.status(400).json({
        message: "Booking not eligible for withdrawal",
      });
    }

    // 3️⃣ Prevent duplicate withdraw request
    const existingWithdraw = await Withdraw.findOne({
      bookingId: booking._id,
    });

    if (existingWithdraw) {
      return res.status(400).json({
        message: "Withdraw request already exists for this booking",
      });
    }

    // 4️⃣ Lock booking payout
    booking.payoutStatus = "requested";
    await booking.save();

    // 5️⃣ Create withdraw request
    const withdraw = await Withdraw.create({
      booking: booking._id,
      provider: providerId,
      amount: booking.providerEarning,
      status: "pending",
    });

    return res.json({
      success: true,
      message: "Withdraw request submitted successfully",
      withdraw,
    });
  } catch (error) {
    console.error("Withdraw Request Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};




/**
 * Provider cancels booking → auto refund to customer
 */
export const cancelBookingByProvider = async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({ message: "Only providers can cancel bookings" });
    }

    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate("user provider");

    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    // 🔐 Provider ownership check

    if (booking.provider._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // 🚫 Already refunded
    if (booking.refundStatus && booking.refundStatus !== "none") {
      return res.status(400).json({ message: "Refund already processed" });
    }

    // 🚫 No payment
    if (!booking.paymentId) {
      return res.status(400).json({ message: "No payment found for this booking" });
    }

    // 1️⃣ Create refund DB record
    const refund = await Refund.create({
      booking: booking._id,
      customer: booking.user._id,
      provider: booking.provider._id,
      amount: booking.bookingAmount,
      reason: reason || "Cancelled by provider",
      initiatedBy: "provider",
      status: "initiated",
    });

    // 2️⃣ Stripe refund
    const stripeRefund = await stripe.refunds.create({
      payment_intent: booking.paymentId,
    });

    // 3️⃣ Reverse payout if already transferred
    if (booking.stripeTransferId) {
      await stripe.transfers.createReversal(booking.stripeTransferId);
    }

    // 4️⃣ Update refund
    refund.status = "processed";
    refund.stripeRefundId = stripeRefund.id;
    await refund.save();

    // 5️⃣ Update booking
    booking.status = "cancelled";
    booking.refundStatus = "refunded";
    booking.refundId = refund._id;
    booking.cancelledBy = "provider";

    // ❌ Prevent withdrawal
    booking.payoutStatus = "cancelled";

    await booking.save();

    res.json({
      success: true,
      message: "Booking cancelled and refund processed",
      refundId: refund._id,
    });

  } catch (error) {
    console.error("Provider Cancel Error:", error);
    res.status(500).json({ message: "Cancellation failed" });
  }
};







