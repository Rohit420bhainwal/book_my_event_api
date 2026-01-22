import stripe from "../utils/stripe.js";
import User from "../models/User.js";

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle onboarding completion
  if (event.type === "account.updated") {
    const account = event.data.object;

    if (
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true
    ) {
      await User.findOneAndUpdate(
        { "providerInfo.stripeAccountId": account.id },
        {
          $set: {
            "providerInfo.stripeOnboardingCompleted": true,
          },
        }
      );

      console.log("✅ Stripe onboarding completed for:", account.id);
    }
  }

  res.json({ received: true });
};
