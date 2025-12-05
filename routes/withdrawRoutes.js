import express from "express";
import {
  requestWithdraw,
  getMyWithdraws,
  updateWithdrawStatus,
  getAllWithdraws,
} from "../controllers/withdrawController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Provider: request withdraw
router.post("/", protect, requestWithdraw);

// Provider: view earnings + history
router.get("/me", protect, getMyWithdraws);

// Admin: approve/reject withdraw (auto payout)
router.put("/:withdrawId/status", protect, updateWithdrawStatus);

router.get("/all", protect, getAllWithdraws);

export default router;
