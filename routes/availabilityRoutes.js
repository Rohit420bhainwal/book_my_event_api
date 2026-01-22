import express from "express";
import {
  getMonthlyAvailability,
  
} from "../controllers/availabilityController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/month", protect, getMonthlyAvailability);
//router.get("/slots", protect, getSlotsForDate);

export default router;
