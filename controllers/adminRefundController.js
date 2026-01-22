import Booking from "../models/Booking.js";
import Refund from "../models/Refund.js";
import stripe from "../utils/stripe.js";

export const adminRefundBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId).populate("user provider");

    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    if (booking.refundStatus !== "none")
      return res.status(400).json({ message: "Refund already processed" });

    if (!booking.paymentId)
      return res.status(400).json({ message: "No payment found for booking" });

    // 1️⃣ Create refund record
    const refund = await Refund.create({
        booking: booking._id,
        customer: booking.user,        // ✅ customer = booking.user
        provider: booking.provider,
        amount: booking.bookingAmount, // or totalAmount if you add later
        reason,
        initiatedBy: "admin",
      });
      

    // 2️⃣ Refund via Stripe
    const stripeRefund = await stripe.refunds.create({
      payment_intent: booking.paymentId,
    });

    // 3️⃣ Reverse transfer if exists
    if (booking.stripeTransferId) {
      await stripe.transfers.createReversal(
        booking.stripeTransferId
      );
    }

    // 4️⃣ Update refund
    refund.status = "processed";
    refund.stripeRefundId = stripeRefund.id;
    await refund.save();

    // 5️⃣ Update booking
    booking.refundStatus = "refunded";
    booking.refundId = refund._id;
    booking.status = "cancelled";
    booking.payoutStatus = "cancelled"
    await booking.save();

    res.json({
      success: true,
      message: "Refund processed successfully",
      refund,
    });
  } catch (error) {
    console.error("Admin Refund Error:", error);
    res.status(500).json({ message: "Refund failed" });
  }
};


export const autoRefundBooking = async (bookingId, reason) => {
    const booking = await Booking.findById(bookingId)
      .populate("customer provider");
  
    if (!booking || booking.refundStatus !== "none") return;
  
    const refund = await Refund.create({
      booking: booking._id,
      customer: booking.customer._id,
      provider: booking.provider._id,
      amount: booking.totalAmount,
      reason,
      initiatedBy: "system",
    });
  
    const stripeRefund = await stripe.refunds.create({
      payment_intent: booking.paymentIntentId,
    });
  
    if (booking.stripeTransferId) {
      await stripe.transfers.createReversal(
        booking.stripeTransferId
      );
    }
  
    refund.status = "processed";
    refund.stripeRefundId = stripeRefund.id;
    await refund.save();
  
    booking.refundStatus = "refunded";
    booking.refundId = refund._id;
    booking.status = "cancelled";
    await booking.save();
  };
  