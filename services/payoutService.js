import razorpayX from "../utils/razorpayx.js";

// Create Razorpay Contact
export const createContact = async (name, email, phone) => {
  const res = await razorpayX.post("/contacts", {
    name,
    email,
    contact: phone,
    type: "vendor",
  });
  return res.data.id;
};

// Create Fund Account (UPI)
export const createFundAccount = async (contactId, upiId) => {
  const res = await razorpayX.post("/fund_accounts", {
    contact_id: contactId,
    account_type: "upi",
    upi: { address: upiId },
  });
  return res.data.id;
};

// Create Payout
export const createPayout = async (fundAccountId, amount) => {
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
