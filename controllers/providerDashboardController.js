import Booking from "../models/Booking.js";

export const getProviderEarningsSummary = async (req, res) => {
  try {
    const bookings = await Booking.find({
      provider: req.user._id,
      status: "confirmed",
    });

    const totalEarned = bookings.reduce(
      (sum, b) => sum + (b.providerEarning || 0),
      0
    );

    const withdrawn = bookings
      .filter(b => b.payoutStatus === "withdrawn")
      .reduce((sum, b) => sum + (b.providerEarning || 0), 0);

    const pending = bookings
      .filter(b => b.payoutStatus === "pending")
      .reduce((sum, b) => sum + (b.providerEarning || 0), 0);

    const available = bookings
      .filter(b => b.payoutStatus === "available")
      .reduce((sum, b) => sum + (b.providerEarning || 0), 0);

    res.json({
      totalEarned,
      withdrawn,
      pending,
      available,
    });
  } catch (error) {
    console.error("Provider Earnings Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
