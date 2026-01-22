import User from "../models/User.js";
//import Withdraw from "../models/Withdraw.js";
import Booking from "../models/Booking.js";
import Withdraw from "../models/WithdrawRequest.js";
import stripe from "../utils/stripe.js";



// ------------------------------------
// ADMIN HELPER → CALCULATE PROVIDER EARNINGS
// ------------------------------------
const calculateProviderEarningsForAdmin = async (providerId) => {
  // Total earnings from confirmed bookings
  const bookings = await Booking.find({
    provider: providerId,
    status: "confirmed",
  });

  const totalEarned = bookings.reduce(
    (sum, b) => sum + (b.providerEarning || 0),
    0
  );

  // Total withdrawn (approved only)
  const withdrawals = await Withdraw.find({
    provider: providerId,
    status: "approved",
  });

  const totalWithdrawn = withdrawals.reduce(
    (sum, w) => sum + (w.amount || 0),
    0
  );

  return {
    totalEarned,
    totalWithdrawn,
    availableBalance: totalEarned - totalWithdrawn,
  };
};


// -------------------------------
// GET ALL PROVIDERS (minimal data for admin)
// -------------------------------
export const getAllProviders = async (req, res) => {
  try {
    const { status } = req.query;

    let filter = { role: "provider" };

    if (status) {
      filter["providerInfo.status"] = status; // pending | approved | rejected
    }

    // Select only the required fields
    const providers = await User.find(filter)
      .select("name email phone role city profileImage providerInfo") // <--- only required
      .sort({ createdAt: -1 });

    // Transform response to include only needed providerInfo fields
    const cleanedProviders = providers.map((p) => ({
      _id: p._id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      role: p.role,
      city: p.city,
      profileImage: p.profileImage,
      providerInfo: {
        businessName: p.providerInfo.businessName || "",
        contactPerson: p.providerInfo.contactPerson || "",
        address: p.providerInfo.address || "",
        city: p.providerInfo.city || "",
        onboardingComplete: p.providerInfo.onboardingComplete || false,
        status: p.providerInfo.status || "pending",
        services: p.providerInfo.services || [],
      },
    }));

    res.json({
      success: true,
      count: cleanedProviders.length,
      providers: cleanedProviders,
    });
  } catch (error) {
    console.log("Get All Providers Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// -------------------------------
// GET SINGLE PROVIDER DETAILS (for admin)
// -------------------------------
export const getProviderById = async (req, res) => {
    try {
      const { id } = req.params;
  
      if (!id) return res.status(400).json({ success: false, message: "Provider ID is required" });
  
      const provider = await User.findById(id)
        .select("name email phone role city profileImage providerInfo"); // only required fields
  
      if (!provider) return res.status(404).json({ success: false, message: "Provider not found" });
  
      // Prepare cleaned provider data
      const cleanedProvider = {
        _id: provider._id,
        name: provider.name,
        email: provider.email,
        phone: provider.phone,
        role: provider.role,
        city: provider.city,
        profileImage: provider.profileImage,
        providerInfo: {
          businessName: provider.providerInfo.businessName || "",
          contactPerson: provider.providerInfo.contactPerson || "",
          address: provider.providerInfo.address || "",
          city: provider.providerInfo.city || "",
          onboardingComplete: provider.providerInfo.onboardingComplete || false,
          status: provider.providerInfo.status || "pending",
          services: provider.providerInfo.services || [],
        },
      };
  
      res.json({ success: true, provider: cleanedProvider });
    } catch (error) {
      console.log("Get Provider By ID Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };




  // ----------------------
  // UPDATE PROVIDER STATUS (ALLOW SUSPEND)
  // ----------------------
  export const updateProviderStatus = async (req, res) => {
    try {
      const { id } = req.params; // provider _id
      const { status } = req.body; // approved | rejected | suspended
  
      // Validate status
      if (!["approved", "rejected", "suspended"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be 'approved', 'rejected', or 'suspended'",
        });
      }
  
      // Find provider
      const provider = await User.findById(id);
      if (!provider) {
        return res.status(404).json({ success: false, message: "Provider not found" });
      }
  
      // Update status
      provider.providerInfo.status = status;
      await provider.save();
  
      res.json({
        success: true,
        provider,
      });
    } catch (error) {
      console.log("Update Provider Status Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  

  export const getAllWithdrawRequests = async (req, res) => {
    try {
      const withdraws = await Withdraw.find()
        .populate("provider", "name email phone")
        .sort({ createdAt: -1 });
  
       
      // Filter broken records safely
      const cleanWithdraws = withdraws.map((w) => ({
        _id: w._id,
        provider: w.provider || null,
        amount: w.amount,
        status: w.status,
        upiId: w.upiId,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));
  
      res.json({
        success: true,
        data: cleanWithdraws,
      });
    } catch (error) {
      console.error("Admin Get Withdraws Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  

  
  export const approveWithdrawRequest = async (req, res) => {
    try {
      const { withdrawId } = req.params;
  
      const withdraw = await Withdraw.findById(withdrawId);
      if (!withdraw)
        return res.status(404).json({ message: "Withdraw not found" });
  
      if (withdraw.status !== "pending") {
        return res.status(400).json({ message: "Withdraw already processed" });
      }
  
      // 1️⃣ Get provider (must have Stripe account)
      const provider = await User.findById(withdraw.provider);
      if (!provider.providerInfo.stripeAccountId) {
        return res.status(400).json({
          message: "Provider does not have Stripe account",
        });
      }
  
      // 2️⃣ Make Stripe transfer
      const transfer = await stripe.transfers.create({
        amount: Math.round(withdraw.amount * 100),
        currency: "usd",
        destination: provider.providerInfo.stripeAccountId,
      });
  
      // 3️⃣ Update selected bookings payoutStatus to withdrawn
        
      // if (withdraw.bookings && withdraw.bookings.length > 0) {
      //   await Booking.updateMany(
      //     { _id: { $in: withdraw.bookings } },
      //     { payoutStatus: "withdrawn", payoutId: withdraw._id }
      //   );
      // }

      await Booking.findByIdAndUpdate(
        withdraw.booking,
        {
          payoutStatus: "withdrawn",
          payoutId: withdraw._id,
        }
      );
      
  
      // 4️⃣ Update withdraw request
      withdraw.status = "approved";
      withdraw.payoutId = "MANUAL_APPROVAL_" + Date.now();
      withdraw.stripeTransferId = transfer.id;
      await withdraw.save();
  
      res.json({
        success: true,
        message: "Withdraw approved successfully",
        withdraw,
      });
    } catch (error) {
      console.error("Approve Withdraw Error:", error);
      res.status(500).json({ message: "Server error" });
    }
  };
  
  export const rejectWithdrawRequest = async (req, res) => {
    try {
      const { withdrawId } = req.params;
  
      const withdraw = await Withdraw.findById(withdrawId);
      if (!withdraw)
        return res.status(404).json({ message: "Withdraw not found" });
  
      if (withdraw.status !== "pending") {
        return res.status(400).json({ message: "Withdraw already processed" });
      }
  
      // 🔁 Restore booking payouts
      await Booking.updateMany(
        {
          provider: withdraw.provider,
          payoutStatus: "processing",
        },
        {
          payoutStatus: "available",
        }
      );
  
      withdraw.status = "rejected";
      withdraw.errorMessage = "Rejected by admin";
      await withdraw.save();
  
      res.json({
        success: true,
        message: "Withdraw rejected successfully",
        withdraw,
      });
    } catch (error) {
      console.error("Reject Withdraw Error:", error);
      res.status(500).json({ message: "Server error" });
    }
  };
  
  export const runAutoPayout = async (req, res) => {
    try {
      const now = new Date();
  
      // 1️⃣ Find eligible bookings
      const bookings = await Booking.find({
        status: "confirmed",
        payoutStatus: "available",
        payoutReleaseDate: { $lte: now },
      }).populate("provider");
  
      if (bookings.length === 0) {
        return res.json({
          success: true,
          message: "No eligible bookings for payout",
        });
      }
  
      const results = [];
  
      // 2️⃣ Process each booking
      for (const booking of bookings) {
        try {
          const provider = booking.provider;
  
          if (!provider?.providerInfo?.stripeAccountId) {
            results.push({
              bookingId: booking._id,
              status: "skipped",
              reason: "Provider has no Stripe account",
            });
            continue;
          }
  
          // 3️⃣ Stripe transfer
          const transfer = await stripe.transfers.create({
            amount: Math.round(booking.providerEarning * 100),
            currency: "usd", // change if needed
            destination: provider.providerInfo.stripeAccountId,
          });
  
          // 4️⃣ Update booking
          booking.payoutStatus = "withdrawn";
          booking.payoutId = transfer.id;
          await booking.save();
  
          results.push({
            bookingId: booking._id,
            status: "success",
            transferId: transfer.id,
          });
        } catch (err) {
          console.error("Auto payout failed:", err);
  
          results.push({
            bookingId: booking._id,
            status: "failed",
            error: err.message,
          });
        }
      }
  
      res.json({
        success: true,
        message: "Auto payout process completed",
        processed: results.length,
        results,
      });
    } catch (error) {
      console.error("Run Auto Payout Error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  };
  