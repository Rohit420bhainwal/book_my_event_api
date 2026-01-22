import express from "express";
import {
  upsertAvailabilityConfig,
  getAvailabilityConfigByService,
} from "../controllers/availabilityConfigController.js";

//import protect from "../middleware/authMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/availability",
  protect,
  upsertAvailabilityConfig
);

router.get(
  "/availability/:serviceId",
  protect,
  getAvailabilityConfigByService
);

export default router;
