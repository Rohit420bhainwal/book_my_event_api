// controllers/userController.js
export const switchRole = async (req, res) => {
    try {
      const { userId, newRole } = req.body;
  
      if (!["customer", "provider"].includes(newRole))
        return res.status(400).json({ message: "Invalid role" });
  
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
  
      if (!user.roles.includes(newRole)) {
        user.roles.push(newRole);
        await user.save();
      }
  
      res.json({ message: "Role switched successfully", roles: user.roles });
    } catch (error) {
      console.error("Switch Role Error:", error);
      res.status(500).json({ message: "Server error" });
    }
  };
  