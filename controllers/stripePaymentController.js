import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPaymentIntent = async (req, res) => {
  try {
    const { amount ,currency} = req.body;

    if (!amount) {
      return res.status(400).json({ message: "Amount is required" });
    }

    const ALLOWED_CURRENCIES = ["inr", "usd", "aed"];
    
    if (!ALLOWED_CURRENCIES.includes(currency)) {
        return res.status(400).json({ message: "Unsupported currency" });
      }

    const paymentIntent = await stripe.paymentIntents.create({
       amount, // in paise (₹100 = 10000)
       currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        source: "flutter_app",
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};
