const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Import your User Mongoose model
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const secretKey = process.env.SECRET_KEY;
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const upload = require("../middleware/upload");
const fs = require("fs");
const csv = require("csv-parser");

const uploads = multer({ dest: "uploads/" });
// Routes

// GET all users
router.get("/getAllUsers", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET a single user by ID
router.get("/getUserById/:id", async (req, res) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      } else if (decoded.username != user.name) {
        res.status(401).json({ message: "User name NOT matching" });
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// GET all users
router.get("/getAllUsers", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET a single user by ID
router.get("/getUserById/:id", async (req, res) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      } else if (decoded.username != user.name) {
        res.status(401).json({ message: "User name NOT matching" });
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// Register a user with an unique Unit Number
router.post("/register", async (req, res) => {
  const {
    name,
    email,
    unitNumber,
    password,
    phoneNumber,
    userRole, // "U01", "U02", or "U03"
    userSecretCode,
    userSubType,
    userSubPaid,
    userPaidAmt,
    userCpnActiveStatus,
    userLastUpdatedBy, // optional, can default to null or a name
  } = req.body;

  try {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      unitNumber,
      password: hashedPassword,
      phoneNumber,
      userRole: userRole,
      userActive: true,
      userSecretCode,
      userSubType,
      userSubPaid,
      userPaidAmt,
      userCpnActiveStatus,
      userLastUpdatedBy,
    });

    const newUser = await user.save();

    const token = jwt.sign({ username: user.name }, secretKey, {
      expiresIn: "1h",
    });

    res.status(201).json({ user: newUser, token });
  } catch (err) {
    if (err.code === 11000) {
      const duplicateField = Object.keys(err.keyPattern)[0];
      return res.status(409).json({
        message: `${
          duplicateField.charAt(0).toUpperCase() + duplicateField.slice(1)
        } already registered.`,
      });
    }
    return res.status(400).json({ message: err.message });
  }
});

// DELETE an user by ID
router.put("/deleteUserById/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(
      new mongoose.Types.ObjectId(req.params.id.toString())
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Login API
router.post("/login", async (req, res) => {
  const { phoneNumber, password } = req.body;

  try {
    // Check if email exists
    const user = await User.findOne({ phoneNumber });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Compare Hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // Create a JWT
    const token = jwt.sign({ username: user.name }, secretKey, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        userRole: user.userRole,
        unitNumber: user.unitNumber,
        phoneNumber: user.phoneNumber,
        userCpnActiveStatus: user.userCpnActiveStatus,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/updateNulls", async (req, res) => {
  try {
    const { unitNumber, ...updateFields } = req.body;

    if (!unitNumber) {
      return res.status(400).json({ message: "unitNumber is required" });
    }

    const user = await User.findOne({ unitNumber });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only update fields that are currently null
    let updated = false;
    for (const key in updateFields) {
      if (user[key] === null && updateFields[key] !== undefined) {
        user[key] = updateFields[key];
        updated = true;
      }
    }

    if (!updated) {
      return res.status(200).json({ message: "No null fields were updated" });
    }

    user.userLastUpdatedDate = new Date();

    await user.save();
    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Error updating user null fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Forgot Password - send reset instructions (basic version)
router.post("/forgotPassword", async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User with this phone number not found" });
    }

    return res.status(200).json({
      message:
        "If this phone number is registered, reset instructions will be sent.",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/verifySecretCode", async (req, res) => {
  const { phoneNumber, userSecretCode } = req.body;

  // Basic validation
  if (!phoneNumber || !userSecretCode) {
    return res
      .status(400)
      .json({ message: "Phone number and secret code are required" });
  }

  try {
    // Find user by phone number
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Match secret code
    if (user.userSecretCode !== userSecretCode) {
      return res.status(401).json({ message: "Invalid secret code" });
    }

    // Success
    return res
      .status(200)
      .json({ message: "Secret code verified successfully" });
  } catch (err) {
    console.error("Verification error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

// DELETE an user by ID
router.put("/deleteUserById/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(
      new mongoose.Types.ObjectId(req.params.id.toString())
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Login API
router.post("/login", async (req, res) => {
  const { phoneNumber, password } = req.body;

  try {
    // Check if email exists
    const user = await User.findOne({ phoneNumber });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Compare Hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // Create a JWT
    const token = jwt.sign({ username: user.name }, secretKey, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        unitNumber: user.unitNumber,
        phoneNumber: user.phoneNumber,
        userCpnActiveStatus: user.userCpnActiveStatus,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/updateNulls", async (req, res) => {
  try {
    const { unitNumber, ...updateFields } = req.body;

    if (!unitNumber) {
      return res.status(400).json({ message: "unitNumber is required" });
    }

    const user = await User.findOne({ unitNumber });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only update fields that are currently null
    let updated = false;
    for (const key in updateFields) {
      if (user[key] === null && updateFields[key] !== undefined) {
        user[key] = updateFields[key];
        updated = true;
      }
    }

    if (!updated) {
      return res.status(200).json({ message: "No null fields were updated" });
    }

    user.userLastUpdatedDate = new Date();

    await user.save();
    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Error updating user null fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Forgot Password - send reset instructions (basic version)
router.post("/forgotPassword", async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User with this phone number not found" });
    }

    return res.status(200).json({
      message:
        "If this phone number is registered, reset instructions will be sent.",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/verifySecretCode", async (req, res) => {
  const { phoneNumber, userSecretCode } = req.body;

  // Basic validation
  if (!phoneNumber || !userSecretCode) {
    return res
      .status(400)
      .json({ message: "Phone number and secret code are required" });
  }

  try {
    // Find user by phone number
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Match secret code
    if (user.userSecretCode !== userSecretCode) {
      return res.status(401).json({ message: "Invalid secret code" });
    }

    // Success
    return res
      .status(200)
      .json({ message: "Secret code verified successfully" });
  } catch (err) {
    console.error("Verification error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch("/updateUserSubDetails", upload.any(), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "CSV file is required." });
  }

  const file = req.files[0];

  fs.createReadStream(file.path);

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      try {
        const bulkOps = results.map((row) => ({
          updateOne: {
            filter: { unitNumber: row.unitNumber },
            update: {
              ...(row.userSubType && { userSubType: row.userSubType }),
              ...(row.userSubPaid && {
                userSubPaid: row.userSubPaid === "true",
              }),
              ...(row.userPaidAmt && {
                userPaidAmt: parseFloat(row.userPaidAmt),
              }),
              ...(row.userCpnActiveStatus && {
                userCpnActiveStatus: row.userCpnActiveStatus === "true",
              }),
              userLastUpdatedBy: "Admin",
              userLastUpdatedDate: new Date(),
            },
          },
        }));

        const result = await User.bulkWrite(bulkOps);

        // Optional: Delete file after processing
        fs.unlinkSync(req.file.path);

        res.json({
          message: "Users updated successfully.",
          matched: result.matchedCount,
          modified: result.modifiedCount,
        });
      } catch (error) {
        console.error("Bulk update error:", error);
        res.status(500).json({ message: "Bulk update failed." });
      }
    });
});

module.exports = router;
