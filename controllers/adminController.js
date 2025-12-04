import User from "../models/User.js";

// -------------------------------
// GET ALL PROVIDERS (minimal data for admin)
// -------------------------------
export const getAllProviders = async (req, res) => {
  try {
    const { status } = req.query;

    let filter = { role: "provider" };

    if (status) {
      filter["providerInfo.status"] = status; // pending | approved | rejected
    }

    // Select only the required fields
    const providers = await User.find(filter)
      .select("name email phone role city profileImage providerInfo") // <--- only required
      .sort({ createdAt: -1 });

    // Transform response to include only needed providerInfo fields
    const cleanedProviders = providers.map((p) => ({
      _id: p._id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      role: p.role,
      city: p.city,
      profileImage: p.profileImage,
      providerInfo: {
        businessName: p.providerInfo.businessName || "",
        contactPerson: p.providerInfo.contactPerson || "",
        address: p.providerInfo.address || "",
        city: p.providerInfo.city || "",
        onboardingComplete: p.providerInfo.onboardingComplete || false,
        status: p.providerInfo.status || "pending",
        services: p.providerInfo.services || [],
      },
    }));

    res.json({
      success: true,
      count: cleanedProviders.length,
      providers: cleanedProviders,
    });
  } catch (error) {
    console.log("Get All Providers Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// -------------------------------
// GET SINGLE PROVIDER DETAILS (for admin)
// -------------------------------
export const getProviderById = async (req, res) => {
    try {
      const { id } = req.params;
  
      if (!id) return res.status(400).json({ success: false, message: "Provider ID is required" });
  
      const provider = await User.findById(id)
        .select("name email phone role city profileImage providerInfo"); // only required fields
  
      if (!provider) return res.status(404).json({ success: false, message: "Provider not found" });
  
      // Prepare cleaned provider data
      const cleanedProvider = {
        _id: provider._id,
        name: provider.name,
        email: provider.email,
        phone: provider.phone,
        role: provider.role,
        city: provider.city,
        profileImage: provider.profileImage,
        providerInfo: {
          businessName: provider.providerInfo.businessName || "",
          contactPerson: provider.providerInfo.contactPerson || "",
          address: provider.providerInfo.address || "",
          city: provider.providerInfo.city || "",
          onboardingComplete: provider.providerInfo.onboardingComplete || false,
          status: provider.providerInfo.status || "pending",
          services: provider.providerInfo.services || [],
        },
      };
  
      res.json({ success: true, provider: cleanedProvider });
    } catch (error) {
      console.log("Get Provider By ID Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };




  // ----------------------
  // UPDATE PROVIDER STATUS (ALLOW SUSPEND)
  // ----------------------
  export const updateProviderStatus = async (req, res) => {
    try {
      const { id } = req.params; // provider _id
      const { status } = req.body; // approved | rejected | suspended
  
      // Validate status
      if (!["approved", "rejected", "suspended"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be 'approved', 'rejected', or 'suspended'",
        });
      }
  
      // Find provider
      const provider = await User.findById(id);
      if (!provider) {
        return res.status(404).json({ success: false, message: "Provider not found" });
      }
  
      // Update status
      provider.providerInfo.status = status;
      await provider.save();
  
      res.json({
        success: true,
        provider,
      });
    } catch (error) {
      console.log("Update Provider Status Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
  