import Booking from "../models/Booking.js";

export const releaseEligiblePayouts = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await Booking.updateMany(
    {
      payoutStatus: "pending",
      payoutReleaseDate: { $lte: today },
      status: "confirmed",
    },
    {
      $set: { payoutStatus: "available" },
    }
  );

  console.log("✅ Payouts released for eligible bookings");
};
