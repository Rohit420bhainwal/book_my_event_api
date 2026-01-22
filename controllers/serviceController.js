// controllers/serviceController.js
import Service from "../models/Service.js";

// Add service (Provider)
export const addService = async (req, res) => {
  try {
    const { name, category, price, address, city, description, images, peopleCapacity } = req.body;

    if (!name || !category || !price || !city) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // Create base data object
    const newServiceData = {
      provider: req.user._id,
      name,
      category,
      description,
      price,
      address,
      city,
      images: images || [],
    };

    // ✅ If user provided peopleCapacity, save it directly
    if (peopleCapacity !== undefined && peopleCapacity !== null) {
      newServiceData.peopleCapacity = Number(peopleCapacity);
    }

    const service = await Service.create(newServiceData);

    res.status(201).json({
      success: true,
      message: "Service added successfully",
      service,
    });
  } catch (error) {
    console.error("Add Service Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};



// Get all services of provider
export const getProviderServices = async (req, res) => {
  try {
    const services = await Service.find({ provider: req.user._id }).populate("category", "name");;

    res.status(200).json({
      data: services,
    });
  } catch (error) {
    console.error("Get Provider Services Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Update a specific service (provider only)
// Update a specific service (provider only)
export const updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, category, price, address, city, description, images, peopleCapacity } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });

    // Authorization check
    if (service.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to update this service" });
    }

    // Update fields
    service.name = name || service.name;
    service.category = category || service.category;
    service.price = price || service.price;
    service.address = address || service.address;
    service.city = city || service.city;
    service.description = description || service.description;
    service.images = images || service.images;

    // ✅ Only allow updating capacity for venues
    if (service.name.trim().toLowerCase() === "venue") {
      service.peopleCapacity = peopleCapacity || service.peopleCapacity;
    }

    await service.save();

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update Service Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


// Get services for customer, filtered by city
export const getServicesForCustomer = async (req, res) => {
  try {
    const customerCity = req.query.city; // e.g., /api/customer/services?city=Pune

    if (!customerCity) {
      return res.status(400).json({ success: false, message: "City is required" });
    }

    // Find services only in the customer's city
    const services = await Service.find({ city: customerCity })
      .populate("category", "name") // populate category with name
      .populate("provider", "name email"); // optional: provider info

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("Get Services For Customer Error:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};

