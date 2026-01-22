import Booking from "../models/Booking.js";
import Withdraw from "../models/Withdraw.js";
import User from "../models/User.js";

import {
  createContact,
  createFundAccount,
  createPayout,
} from "../services/payoutService.js";

// ---------------------------------------------------------
// CALCULATE EARNINGS
// ---------------------------------------------------------
const calculateProviderEarnings = async (providerId) => {
  const bookings = await Booking.find({
    provider: providerId,
    status: "confirmed",
  });

  const totalEarned = bookings.reduce(
    (sum, b) => sum + (b.providerEarning || 0),
    0
  );

  const withdrawals = await Withdraw.find({
    provider: providerId,
    status: "approved",
  });

  const totalWithdrawn = withdrawals.reduce(
    (sum, w) => sum + w.amount,
    0
  );

  return {
    totalEarned,
    totalWithdrawn,
    available: totalEarned - totalWithdrawn,
  };
};


// ---------------------------------------------------------
// PROVIDER → REQUEST WITHDRAW
// ---------------------------------------------------------
export const requestWithdraw = async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({ message: "Only providers can withdraw" });
    }

    const { amount, upiId } = req.body;

    if (!amount || !upiId) {
      return res.status(400).json({ message: "Amount & UPI ID required" });
    }

    const { available } = await calculateProviderEarnings(req.user._id);

    if (amount > available) {
      return res.status(400).json({
        message: `You can withdraw only ₹${available}`,
      });
    }

    const withdraw = await Withdraw.create({
      provider: req.user._id,
      amount,
      upiId,
      status: "pending",
    });

    res.status(201).json({
      message: "Withdraw request submitted",
      withdraw,
    });
  } catch (error) {
    console.error("Withdraw Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ---------------------------------------------------------
// PROVIDER → GET WITHDRAW HISTORY
// ---------------------------------------------------------
export const getMyWithdraws = async (req, res) => {
  try {
    const earnings = await calculateProviderEarnings(req.user._id);

    const withdraws = await Withdraw.find({
      provider: req.user._id,
    }).sort({ createdAt: -1 });

  //  res.json({ earnings, withdraws });
    res.json({withdraws });
  } catch (error) {
    console.error("Get Withdraw Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ---------------------------------------------------------
// ADMIN → APPROVE WITHDRAW (AUTO PAYOUT)
// ---------------------------------------------------------
// ---------------------------------------------------------
// ADMIN → APPROVE/REJECT WITHDRAW (WITH SIMULATION MODE)
// ---------------------------------------------------------
export const updateWithdrawStatus = async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only admin can update withdrawals" });
      }
  
      const { withdrawId } = req.params;
      const { status } = req.body; // approved or rejected
  
      const withdraw = await Withdraw.findById(withdrawId).populate("provider");
      if (!withdraw) return res.status(404).json({ message: "Withdraw not found" });
  
      // If REJECTED → just update status
      if (status === "rejected") {
        withdraw.status = "rejected";
        await withdraw.save();
        return res.json({
          message: "Withdraw rejected successfully",
          withdraw,
        });
      }
  
      // If APPROVED → handle payout logic
      if (status === "approved") {
        
        // *************************************
        // 🚨 TEMPORARY SIMULATION MODE
        // No Razorpay keys? Use fake payout
        // *************************************
        const fakePayoutId = "SIM_PAYOUT_" + Date.now();
  
        withdraw.status = "approved";
        withdraw.payoutId = fakePayoutId;  // Store fake payout ID
        withdraw.simulated = true;         // mark as simulation
        withdraw.payoutTimestamp = new Date();
  
        await withdraw.save();
  
        return res.json({
          message: "Withdrawal approved successfully (SIMULATED PAYOUT)",
          withdraw,
        });
  
  
        // -------------------------------------------------------------------
        // 👇 UNCOMMENT WHEN YOU GET RAZORPAY KEYS — REAL PRODUCTION PAYOUT
        // -------------------------------------------------------------------
  
        /*
        const provider = withdraw.provider;
  
        // 1. CREATE CONTACT IF NOT EXISTS
        if (!provider.razorpayContactId) {
          const contact = await axios.post(
            "https://api.razorpay.com/v1/contacts",
            {
              name: provider.name,
              email: provider.email,
              contact: provider.phone,
              type: "employee"
            },
            {
              auth: {
                username: process.env.RAZORPAY_KEY_ID,
                password: process.env.RAZORPAY_KEY_SECRET
              }
            }
          );
  
          provider.razorpayContactId = contact.data.id;
          await provider.save();
        }
  
        // 2. CREATE FUND ACCOUNT IF NOT EXISTS
        if (!provider.razorpayFundAccountId) {
          const fundAccount = await axios.post(
            "https://api.razorpay.com/v1/fund_accounts",
            {
              contact_id: provider.razorpayContactId,
              account_type: "vpa",
              vpa: { address: withdraw.upiId }
            },
            {
              auth: {
                username: process.env.RAZORPAY_KEY_ID,
                password: process.env.RAZORPAY_KEY_SECRET
              }
            }
          );
  
          provider.razorpayFundAccountId = fundAccount.data.id;
          await provider.save();
        }
  
        // 3. SEND PAYOUT
        const payout = await axios.post(
          "https://api.razorpay.com/v1/payouts",
          {
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
            fund_account_id: provider.razorpayFundAccountId,
            amount: withdraw.amount * 100,
            currency: "INR",
            mode: "UPI",
            purpose: "payout",
          },
          {
            auth: {
              username: process.env.RAZORPAY_KEY_ID,
              password: process.env.RAZORPAY_KEY_SECRET
            }
          }
        );
  
        withdraw.status = "approved";
        withdraw.payoutId = payout.data.id;
        await withdraw.save();
  
        return res.json({
          message: "Withdrawal approved and paid successfully",
          withdraw,
        });
        */
  
        // -------------------------------------------------------------------
      }
  
      return res.status(400).json({ message: "Invalid status value" });
    } catch (error) {
      console.error("Update Withdraw Error:", error);
      return res
        .status(500)
        .json({ message: "Server error", error: error.message });
    }
  };


  // ---------------------------------------------------------
// ADMIN → GET ALL WITHDRAWAL REQUESTS
// ---------------------------------------------------------
export const getAllWithdraws = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can view all withdrawals" });
    }

    // Fetch all withdraw requests and populate provider info
    const withdraws = await Withdraw.find()
      .populate("provider", "_id name email phone businessName")
      .sort({ createdAt: -1 }); // latest first

    res.json({
      success: true,
      data: withdraws,
    });
  } catch (error) {
    console.error("Get All Withdraws Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

  