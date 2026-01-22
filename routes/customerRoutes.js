import express from "express";
import { getServicesForCustomer } from "../controllers/customerController.js";
import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();

// GET /api/customer/services?city=Pune
router.get("/services", protect, getServicesForCustomer);

export default router;
