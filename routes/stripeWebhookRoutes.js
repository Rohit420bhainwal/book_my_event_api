import express from "express";
import bodyParser from "body-parser";
import { stripeWebhook } from "../controllers/stripeWebhookController.js";

const router = express.Router();

// Stripe webhook MUST use raw body
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  stripeWebhook
);

export default router;
