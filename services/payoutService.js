import razorpayX from "../utils/razorpayx.js";

const isSimulation = process.env.PAYOUT_MODE === "SIMULATION";

// -----------------------------
// CREATE CONTACT
// -----------------------------
export const createContact = async (name, email, phone) => {
  if (isSimulation) {
    return "SIM_CONTACT_" + Date.now();
  }

  const res = await razorpayX.post("/contacts", {
    name,
    email,
    contact: phone,
    type: "vendor",
  });

  return res.data.id;
};

// -----------------------------
// CREATE FUND ACCOUNT
// -----------------------------
export const createFundAccount = async (contactId, upiId) => {
  if (isSimulation) {
    return "SIM_FUND_" + Date.now();
  }

  const res = await razorpayX.post("/fund_accounts", {
    contact_id: contactId,
    account_type: "upi",
    upi: { address: upiId },
  });

  return res.data.id;
};

// -----------------------------
// CREATE PAYOUT
// -----------------------------
export const createPayout = async (fundAccountId, amount) => {
  if (isSimulation) {
    return {
      id: "SIM_PAYOUT_" + Date.now(),
      status: "processed",
      amount: amount * 100,
    };
  }

  const res = await razorpayX.post("/payouts", {
    account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
    fund_account_id: fundAccountId,
    amount: amount * 100,
    currency: "INR",
    mode: "UPI",
    purpose: "payout",
  });

  return res.data;
};
