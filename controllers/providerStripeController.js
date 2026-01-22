import stripe from "../utils/stripe.js";
import User from "../models/User.js";

export const createStripeAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.role !== "provider") {
      return res.status(403).json({ message: "Only providers allowed" });
    }

    // Already created
    if (user.providerInfo?.stripeAccountId) {
      return res.json({
        success: true,
        stripeAccountId: user.providerInfo.stripeAccountId,
      });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
    });

    user.providerInfo.stripeAccountId = account.id;
    await user.save();

    res.json({
      success: true,
      stripeAccountId: account.id,
    });
  } catch (err) {
    console.error("Stripe account create error:", err);
    res.status(500).json({ message: "Stripe account creation failed" });
  }
};

export const getStripeOnboardingLink = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.providerInfo?.stripeAccountId) {
      return res.status(400).json({ message: "Stripe account not created" });
    }

    const link = await stripe.accountLinks.create({
      account: user.providerInfo.stripeAccountId,
      refresh_url: "https://yourapp.com/reauth",
      return_url: "https://yourapp.com/success",
      type: "account_onboarding",
    });

    res.json({ success: true, url: link.url });
  } catch (err) {
    console.error("Stripe onboarding link error:", err);
    res.status(500).json({ message: "Failed to create onboarding link" });
  }
};
