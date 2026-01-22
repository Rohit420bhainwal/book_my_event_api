import Service from "../models/Service.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

export const providerService = async (req, res) => {
  try {
    const {
      userId,
      action,
      serviceId,
      categoryId,
      serviceType,
      description,
      price,
      dynamicFields,
      commissionPercent
    } = req.body;

    if (!userId || !action)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    // Upload Images
    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const filename = `${Date.now()}_${file.originalname}`;
        const filePath = path.join("uploads", filename);
        fs.writeFileSync(filePath, file.buffer);
        uploadedImages.push(filename);
      });
    }

    // ---------- ADD ----------
    if (action === "add") {
      const priceNum = Number(price || 0);
      const commission = Number(commissionPercent || 10);

      const appEarning = priceNum * (commission / 100);
      const providerEarning = priceNum - appEarning;

      const newService = new Service({
        userId,
        categoryId,
        serviceType,
        description,
        dynamicFields: dynamicFields ? JSON.parse(dynamicFields) : {},
        price: priceNum,
        commissionPercent: commission,
        providerEarning,
        appEarning,
        images: uploadedImages
      });

      await newService.save();

      return res.json({
        success: true,
        message: "Service added successfully",
        service: newService
      });
    }

    // ---------- EDIT ----------
    if (action === "edit") {
      const existing = await Service.findById(serviceId);
      if (!existing)
        return res.status(404).json({ success: false, message: "Service not found" });

      // Existing + new images
      let oldImages = [];
      if (req.body.existingImages) oldImages = JSON.parse(req.body.existingImages);

      let deletedImages = [];
      if (req.body.deletedImages) {
        deletedImages = JSON.parse(req.body.deletedImages);

        deletedImages.forEach((img) => {
          const filePath = path.join("uploads", img);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
      }

      const finalImages = [...oldImages, ...uploadedImages];

      const priceNum = Number(price || existing.price);
      const commission = Number(commissionPercent || existing.commissionPercent);

      const appEarning = priceNum * (commission / 100);
      const providerEarning = priceNum - appEarning;

      existing.set({
        categoryId,
        serviceType,
        description,
        dynamicFields: dynamicFields ? JSON.parse(dynamicFields) : existing.dynamicFields,
        price: priceNum,
        commissionPercent: commission,
        providerEarning,
        appEarning,
        images: finalImages,
        updatedAt: new Date()
      });

      await existing.save();

      return res.json({
        success: true,
        message: "Service updated successfully",
        service: existing
      });
    }

    // ---------- DELETE ----------
    if (action === "delete") {
      const existing = await Service.findById(serviceId);
      if (!existing)
        return res.status(404).json({ success: false, message: "Service not found" });

      // delete images
      existing.images.forEach((img) => {
        const filePath = path.join("uploads", img);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });

      await Service.findByIdAndDelete(serviceId);

      return res.json({ success: true, message: "Service deleted" });
    }

    return res.status(400).json({ success: false, message: "Invalid action" });

  } catch (error) {
    console.error("Service error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
