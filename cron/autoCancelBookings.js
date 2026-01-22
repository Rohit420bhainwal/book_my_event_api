import cron from "node-cron";
import Booking from "../models/Booking.js";
import stripe from "../utils/stripe.js";

cron.schedule("*/10 * * * *", async () => {

//cron.schedule("* * * * *", async () => {    
  console.log("⏰ Auto-cancel cron running...");

  try {
    const now = new Date();

    const expiredBookings = await Booking.find({
      status: "pending",
      providerResponseDeadline: { $lt: now },
      refundStatus: "none",
      paymentStatus: { $in: ["advance_paid", "fully_paid"] },
    });

    for (const booking of expiredBookings) {
      try {
        let refundPaymentIntentId = null;

        // Decide which payment to refund
        if (booking.paymentStatus === "fully_paid") {
          refundPaymentIntentId = booking.advancePaymentId;
        } else if (booking.paymentStatus === "advance_paid") {
          refundPaymentIntentId = booking.advancePaymentId;
        }

        if (!refundPaymentIntentId) {
          console.error("No paymentIntent found for booking", booking._id);
          continue;
        }

        // 🔁 Stripe Refund
        const refund = await stripe.refunds.create({
          payment_intent: refundPaymentIntentId,
        });

        // Update booking
        booking.status = "cancelled";
        booking.cancelReason =
          "Provider did not respond within allowed time";
        booking.refundStatus = "refunded";
        booking.refundId = refund.id;
        booking.payoutStatus = "cancelled";

        await booking.save();

        console.log(
          `✅ Booking ${booking._id} cancelled & refunded`
        );
      } catch (refundErr) {
        console.error(
          `❌ Refund failed for booking ${booking._id}`,
          refundErr.message
        );

        booking.refundStatus = "failed";
        await booking.save();
      }
    }
  } catch (err) {
    console.error("❌ Auto-cancel cron error:", err.message);
  }
});
