import stripe from "../utils/stripe.js";
import Booking from "../models/Booking.js";
import Withdraw from "../models/Withdraw.js";
import User from "../models/User.js";

export const withdrawBookingAmount = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.provider.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: "Not authorized" });
    if (booking.status !== "confirmed")
      return res.status(400).json({ success: false, message: "Booking not confirmed" });
    if (booking.payoutStatus !== "available")
      return res.status(400).json({ success: false, message: "Payout not available or already withdrawn" });

    const provider = await User.findById(req.user._id);
    if (!provider.providerInfo?.stripeAccountId) {
      return res.status(400).json({ success: false, message: "Provider does not have a Stripe account" });
    }

    // Create Transfer in Stripe
    const transfer = await stripe.transfers.create({
      amount: Math.round(booking.providerEarning * 100), // amount in paise/ smallest currency unit
      currency: "usd",
      destination: provider.providerInfo.stripeAccountId,
      description: `Booking Payout for booking ${bookingId}`,
    });

    // Update booking
    booking.payoutStatus = "withdrawn";
    booking.payoutId = transfer.id;
    booking.withdrawnAt = new Date();
    await booking.save();

    // Create Withdraw record
    await Withdraw.create({
      provider: req.user._id,
      amount: booking.providerEarning,
      status: "approved",
      payoutId: transfer.id,
      upiId: "STRIPE_PAYOUT",
    });

    res.json({ success: true, message: "Payment withdrawn successfully", payoutId: transfer.id });
  } catch (error) {
    console.error("Withdraw error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
