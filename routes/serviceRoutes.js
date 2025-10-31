// routes/serviceRoutes.js
import express from "express";
import { addService, getProviderServices, updateService } from "../controllers/serviceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only providers can add service
router.post("/", protect, addService);

// Get all services of logged-in provider
router.get("/", protect, getProviderServices);

// Update a specific service by ID
router.put("/:serviceId", protect, updateService);


export default router;
