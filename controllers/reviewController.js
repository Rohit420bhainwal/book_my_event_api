/// reviewController.js

/// reviewController.js
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import Review from "../models/Review.js";


export const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const booking = await Booking.findById(bookingId)
      .populate("provider"); // ✅ ONLY provider

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ message: "Booking not completed" });
    }

    if (booking.refundStatus !== "none") {
      return res.status(400).json({ message: "Refunded booking cannot be reviewed" });
    }

    if (booking.reviewStatus === "submitted") {
      return res.status(400).json({ message: "Review already submitted" });
    }

    // 🔍 Find service from provider's embedded services
    const provider = booking.provider;

    const service = provider.providerInfo.services.find(
      s => s.selectedServiceId === booking.service.toString()
    );

    // 1️⃣ Create review
    const review = await Review.create({
      booking: booking._id,
      customer: booking.user,
      provider: provider._id,
      service: booking.service, // still store ID reference
      rating,
      comment,
      providerSnapshot: {
        businessName: provider.providerInfo.businessName,
      },
      serviceSnapshot: {
        name: service?.serviceType || "Unknown Service",
        category: booking.category,
      },
    });

    // 2️⃣ Update booking
    booking.reviewStatus = "submitted";
    booking.reviewId = review._id;
    await booking.save();

    // 3️⃣ Update provider rating (AVG + COUNT + DISTRIBUTION)
    if (!provider.providerInfo.rating) {
      provider.providerInfo.rating = {
        avgRating: 0,
        ratingCount: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const ratingInfo = provider.providerInfo.rating;

    const oldCount = ratingInfo.ratingCount;
    const newCount = oldCount + 1;

    ratingInfo.avgRating = Number(
      ((ratingInfo.avgRating * oldCount + rating) / newCount).toFixed(2)
    );
    ratingInfo.ratingCount = newCount;
    ratingInfo.ratingDistribution[rating] += 1;

    await provider.save();

    res.json({
        success: true,
        message: "Review submitted successfully",
        reviewId: review._id,
          reviewStatus: "submitted",
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
      });
      

  } catch (error) {
    console.error("Create Review Error:", error);
    res.status(500).json({ message: "Failed to submit review" });
  }
};

  
  

  export const getProviderReviews = async (req, res) => {
    const { providerId } = req.params;
  
    const reviews = await Review.find({
      provider: providerId,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .populate("customer", "name profileImage");
  
    res.json(reviews);
  };

  export const getProviderRatingSummary = async (req, res) => {
    const provider = await User.findById(req.params.providerId);
  
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
  
    res.json({
      avgRating: provider.providerInfo.rating?.avgRating || 0,
      ratingCount: provider.providerInfo.rating?.ratingCount || 0,
    });
  };
  

  /**
 * GET REVIEW BY ID
 * Used when booking.reviewStatus === "submitted"
 */
  export const getReviewById = async (req, res) => {
    try {
      const { reviewId } = req.params;
  
      const review = await Review.findById(reviewId)
        .populate("customer", "name profileImage")
        .lean();
  
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
  
      if (review.status !== "active") {
        return res.status(403).json({ message: "Review not available" });
      }
  
      // ✅ FLATTENED RESPONSE (NO DOUBLE WRAP)
      res.json({
        _id: review._id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          customer: review.customer
            ? {
                name: review.customer.name,
                profileImage: review.customer.profileImage || "",
              }
            : null,
          provider: {
            businessName:
              review.providerSnapshot?.businessName || "Unknown",
          },
          service: review.serviceSnapshot,
      });
    } catch (error) {
      console.error("Get Review By ID Error:", error);
      res.status(500).json({ message: "Failed to fetch review" });
    }
  };
  
