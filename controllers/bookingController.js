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
      paymentType, // "ADVANCE" | "FULL" | "REMAINING"
      providerId,
      serviceId,
      date,
      slot,
      bookingId,
      currency = "inr",
    } = req.body;

    if (!paymentType) {
      return res.status(400).json({ message: "paymentType is required" });
    }

    const ALLOWED_CURRENCIES = ["inr", "usd", "aed"];
    if (!ALLOWED_CURRENCIES.includes(currency)) {
      return res.status(400).json({ message: "Unsupported currency" });
    }

    let amountToPay = 0;
    let metadata = {};

    // =====================================================
    // 🔹 ADVANCE (25%) OR FULL (100%) → NEW BOOKING
    // =====================================================
    if (paymentType === "ADVANCE" || paymentType === "FULL") {
      if (!providerId || !serviceId || !date || !slot) {
        return res.status(400).json({
          message: "providerId, serviceId, date and slot are required",
        });
      }

      if (isNaN(new Date(date).getTime())) {
        return res.status(400).json({ message: "Invalid booking date" });
      }

      const provider = await User.findById(providerId);
      if (!provider || provider.role !== "provider") {
        return res.status(404).json({ message: "Provider not found" });
      }

      const service = provider.providerInfo?.services?.find(
        (s) => s._id.toString() === serviceId
      );

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      const isSlotAvailable = await checkSlotAvailability({
        serviceId,
        date,
        slot,
      });

      if (!isSlotAvailable) {
        return res.status(409).json({
          message: "Selected slot is no longer available",
        });
      }

      const totalAmount = service.price;
      let advanceAmount = 0;
      let remainingAmount = 0;

      if (paymentType === "ADVANCE") {
        advanceAmount = Math.round(totalAmount * 0.25);
        remainingAmount = totalAmount - advanceAmount;
        amountToPay = advanceAmount;
      } else {
        advanceAmount = totalAmount;
        remainingAmount = 0;
        amountToPay = totalAmount;
      }

      metadata = {
        paymentType,
        providerId,
        serviceId,
        date,
        slot,
        totalAmount,
        advanceAmount,
        remainingAmount,
      };
    }

    // =====================================================
    // 🔹 REMAINING PAYMENT (75%)
    // =====================================================
    if (paymentType === "REMAINING") {
      if (!bookingId) {
        return res.status(400).json({
          message: "bookingId is required for REMAINING payment",
        });
      }

      const booking = await Booking.findById(bookingId);

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.status === "cancelled") {
        return res.status(400).json({ message: "Booking is cancelled" });
      }

      if (booking.paymentStatus !== "advance_paid") {
        return res.status(400).json({
          message: "Remaining payment not allowed for this booking",
        });
      }

      if (
        booking.paymentDeadline &&
        new Date() > new Date(booking.paymentDeadline)
      ) {
        return res.status(400).json({
          message: "Payment deadline crossed",
        });
      }

      if (booking.remainingAmount <= 0) {
        return res.status(400).json({
          message: "No remaining amount to pay",
        });
      }

      amountToPay = booking.remainingAmount;

      metadata = {
        paymentType: "REMAINING",
        bookingId: booking._id.toString(),
        totalAmount: booking.totalAmount,
        advanceAmount: booking.advanceAmount,
        remainingAmount: booking.remainingAmount,
      };
    }

    // =====================================================
    // 🔹 CREATE STRIPE PAYMENT INTENT
    // =====================================================
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountToPay * 100),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountToPay,
      paymentType,
    });
  } catch (error) {
    console.error("createPaymentIntent error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


export const confirmBooking = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res
        .status(403)
        .json({ message: "Only customers can confirm payments" });
    }

    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "paymentIntentId is required" });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ message: "Payment not successful" });
    }

    const metadata = paymentIntent.metadata;
    const paymentType = metadata.paymentType;

    if (!paymentType) {
      return res.status(400).json({ message: "Invalid payment metadata" });
    }

    // =====================================================
    // 🔹 ADVANCE / FULL → CREATE BOOKING
    // =====================================================
    if (paymentType === "ADVANCE" || paymentType === "FULL") {
      const {
        providerId,
        serviceId,
        date,
        slot,
        totalAmount,
        advanceAmount,
        remainingAmount,
      } = metadata;

      const provider = await User.findById(providerId);
      if (!provider || provider.role !== "provider") {
        return res.status(404).json({ message: "Provider not found" });
      }

      const service = provider.providerInfo?.services?.find(
        (s) => s._id.toString() === serviceId
      );

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      const stillAvailable = await checkSlotAvailability({
        serviceId,
        date,
        slot,
      });

      if (!stillAvailable) {
        return res.status(409).json({
          message:
            "Slot became unavailable after payment. Refund will be initiated.",
        });
      }

      const settings = await Settings.findOne({ key: "commission" });
      const commissionType = settings?.commissionType || "percentage";
      const commissionValue = settings?.commissionValue || 15;

      const commissionAmount =
        commissionType === "percentage"
          ? (totalAmount * commissionValue) / 100
          : commissionValue;

      const providerEarning = totalAmount - commissionAmount;

      const bookingDate = new Date(date);
      bookingDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil(
        (bookingDate - today) / (1000 * 60 * 60 * 24)
      );

      const bookingType = diffDays <= 2 ? "urgent" : "regular";

      const payoutReleaseDate =
        bookingType === "urgent"
          ? new Date()
          : new Date(bookingDate.getTime() - 24 * 60 * 60 * 1000);

      const isFullPayment = paymentType === "FULL";

      const paymentDeadline = isFullPayment
        ? null
        : new Date(bookingDate.getTime() - 24 * 60 * 60 * 1000);

      const providerResponseDeadline =
        bookingType === "urgent"
          ? new Date(Date.now() + 1 * 60 * 60 * 1000)
          : new Date(Date.now() + 24 * 60 * 60 * 1000);

      const booking = await Booking.create({
        user: req.user._id,
        provider: providerId,
        service: serviceId,
        date: bookingDate,
        slot,
        category: service.serviceType,
        status: "pending",
        paymentStatus: isFullPayment ? "fully_paid" : "advance_paid",
        totalAmount: Number(totalAmount),
        advanceAmount: Number(advanceAmount),
        paidAmount: isFullPayment
          ? Number(totalAmount)
          : Number(advanceAmount),
        remainingAmount: isFullPayment ? 0 : Number(remainingAmount),
        advancePaymentId: paymentIntent.id,
        paymentDeadline,
        commissionType,
        commissionValue,
        commissionAmount,
        providerEarning,
        bookingType,
        payoutReleaseDate,
        payoutStatus: "pending",
        providerResponseDeadline,
        refundStatus: "none",
      });

      return res.status(201).json({
        message: isFullPayment
          ? "Full payment successful. Booking pending provider confirmation."
          : "Advance payment successful. Booking created.",
        booking,
      });
    }

    // =====================================================
    // 🔹 REMAINING PAYMENT → UPDATE BOOKING
    // =====================================================
    if (paymentType === "REMAINING") {
      const { bookingId } = metadata;

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.paymentStatus !== "advance_paid") {
        return res.status(400).json({
          message: "Booking not eligible for remaining payment",
        });
      }

      booking.paidAmount = booking.totalAmount;
      booking.remainingAmount = 0;
      booking.paymentStatus = "fully_paid";
      booking.remainingPaymentId = paymentIntent.id;

      await booking.save();

      return res.status(200).json({
        message:
          "Remaining payment successful. Awaiting provider confirmation.",
        booking,
      });
    }

    return res.status(400).json({ message: "Unsupported payment type" });
  } catch (error) {
    console.error("confirmBooking error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};




export const checkSlotAvailability = async ({ serviceId, date, slot }) => {
  // Convert date to start of day
  const bookingDate = new Date(date);
  bookingDate.setHours(0, 0, 0, 0);

  // Check if any booking already exists for this service, date, and slot
  const existingBooking = await Booking.findOne({
    service: serviceId,
    date: bookingDate,
    slot: slot,
    status: { $ne: "cancelled" }, // exclude cancelled bookings
  });

  return !existingBooking; // true if available
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

// controllers/bookingController.js
export const completeBookingByProvider = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // 🔐 Provider auth check
    if (booking.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ❌ Already completed
    if (booking.status === "completed") {
      return res.status(400).json({ message: "Booking already completed" });
    }

    // ❌ Cancelled / refunded safety
    if (booking.status === "canceled" || booking.refundStatus !== "none") {
      return res
        .status(400)
        .json({ message: "Cancelled or refunded booking cannot be completed" });
    }

    // 💳 Payment check
    if (booking.paymentStatus !== "fully_paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    // 📌 Status check
    if (booking.status !== "confirmed") {
      return res
        .status(400)
        .json({ message: "Booking not in confirmed state" });
    }

    // ⏰ SERVICE DATE CHECK (IMPORTANT)
    const now = new Date();
    const serviceDate = new Date(booking.date);

   
    if (now < serviceDate) {
      return res.status(400).json({
        message: "Booking cannot be completed before service date",
      });
    }

    // ✅ Mark completed
    booking.status = "completed";
    booking.payoutStatus = "available";
    booking.completedAt = now; // (optional but recommended)

    await booking.save();

    return res.json({
      success: true,
      message: "Booking marked as completed",
    });
  } catch (error) {
    console.error("Complete Booking Error:", error);
    res.status(500).json({ message: "Failed to complete booking" });
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
      status: "completed",
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

    const booking = await Booking.findById(bookingId).populate("user provider");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // 🔐 Ownership check
    if (booking.provider._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // 🚫 Already refunded
    if (booking.refundStatus !== "none") {
      return res.status(400).json({ message: "Refund already processed" });
    }

    // 🚫 Nothing paid
    if (!booking.advancePaymentId && !booking.remainingPaymentId) {
      return res.status(400).json({ message: "No payment to refund" });
    }

    // 1️⃣ Create refund record (INITIATED)
    const refund = await Refund.create({
      booking: booking._id,
      customer: booking.user._id,
      provider: booking.provider._id,
      amount: 0,
      reason: reason || "Cancelled by provider",
      initiatedBy: "provider",
      status: "initiated",
      refundDetails: [],
    });

    let totalRefunded = 0;
    const refundDetails = [];

    // 2️⃣ Refund ADVANCE payment
    if (booking.advancePaymentId && booking.paidAmount >= booking.advanceAmount) {
      const advanceRefund = await stripe.refunds.create({
        payment_intent: booking.advancePaymentId,
      });

      refundDetails.push({
        paymentIntentId: booking.advancePaymentId,
        stripeRefundId: advanceRefund.id,
        amount: booking.advanceAmount,
      });

      totalRefunded += booking.advanceAmount;
    }

    // 3️⃣ Refund REMAINING payment (only if actually paid)
    const remainingPaid = booking.paidAmount - booking.advanceAmount;

    if (booking.remainingPaymentId && remainingPaid > 0) {
      const remainingRefund = await stripe.refunds.create({
        payment_intent: booking.remainingPaymentId,
      });

      refundDetails.push({
        paymentIntentId: booking.remainingPaymentId,
        stripeRefundId: remainingRefund.id,
        amount: remainingPaid,
      });

      totalRefunded += remainingPaid;
    }

    // 4️⃣ Reverse payout if already transferred
    if (booking.stripeTransferId) {
      await stripe.transfers.createReversal(booking.stripeTransferId);
    }

    // 5️⃣ Update refund record (PROCESSED)
    refund.amount = totalRefunded;
    refund.status = "processed";
    refund.refundDetails = refundDetails;
    refund.stripeRefundId = refundDetails
      .map(r => r.stripeRefundId)
      .join(",");
    await refund.save();

    // 6️⃣ Update booking
    booking.status = "cancelled";
    booking.refundStatus = "refunded";
    booking.refundId = refund._id;
    booking.cancelledBy = "provider";
    booking.payoutStatus = "cancelled";
    await booking.save();

    res.json({
      success: true,
      message: "Booking cancelled and refund processed",
      refundedAmount: totalRefunded,
      refundBreakup: refundDetails,
      refundId: refund._id,
    });

  } catch (error) {
    console.error("Provider Cancel Error:", error);
    res.status(500).json({ message: "Cancellation failed" });
  }
};



