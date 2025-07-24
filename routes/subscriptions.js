const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");
const Coupon = require("../models/Coupon");
const Subscription = require("../models/Subscription");
const User = require("../models/User");

dotenv.config();

const router = express.Router();

// Mongo URI
const mongoURI = process.env.MONGO_URI;

// GridFS Storage Engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) =>
    new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);
        const filename = buf.toString("hex") + path.extname(file.originalname);
        resolve({ filename, bucketName: "uploads" });
      });
    }),
});

const upload = multer({ storage });

// ======================
// POST /subscription/create
// ======================
router.post("/create", upload.single("userPaymentImage"), async (req, res) => {
  try {
    const {
      userID,
      unitNumber,
      userPaymentAmount,
      userSubscriptionType,
      userSubscriptionDate,
      userPaymentMode,
      userPaymentGivenTo,
      userChequeNumber,
      userChequeBankName,
      userPaymentRefID,
      userTransfererBank,
      userPaymentSubscriptionDesc,
    } = req.body;

    // Check user exists
    const user = await User.findOne({ unitNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Construct new subscription entry
    const newSub = new Subscription({
      userID,
      unitNumber,
      userSubscriptionStatus: "PEN",
      userSubscriptionDate: new Date(userSubscriptionDate) || new Date(),
      userSubscriptionType,
      userPaymentAmount,
      userPaymentMode,
      userPaymentGivenTo,
      userChequeNumber,
      userChequeBankName,
      userPaymentRefID,
      userTransfererBank,
      userPaymentImages: req.file?.filename || "", // Store uploaded GridFS filename
      userPaymentSubscriptionDesc,
      userSessionYear: new Date().getFullYear(),
    });

    await newSub.save();

    return res.status(201).json({
      message: "Payment with image uploaded successfully",
      subscription: newSub,
    });
  } catch (err) {
    console.error("Error in /create route:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// === Check Subscription Status ===
router.post("/checkSubscriptionStatus", async (req, res) => {
  const { unitNumber } = req.body;

  if (!unitNumber)
    return res.status(400).json({ message: "unitNumber is required" });

  try {
    const subscription = await Subscription.findOne({ unitNumber }).sort({
      userSubscriptionDate: -1,
    });

    if (!subscription) {
      return res
        .status(404)
        .json({ message: "No subscription found for this user." });
    }

    return res.status(200).json({
      message: "Subscription found",
      subscriptionStatus: subscription.userSubscriptionStatus,
      subscriptionType: subscription.userSubscriptionType,
      subscriptionDate: subscription.userSubscriptionDate,
    });
  } catch (err) {
    console.error("Error checking subscription status:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// === Get Subscription Summary ===
router.post("/getUserSubscriptionSummary", async (req, res) => {
  try {
    const { unitNumber } = req.body;

    if (!unitNumber)
      return res.status(400).json({ message: "unitNumber is required" });

    const subscription = await Subscription.findOne({ unitNumber }).populate(
      "userID"
    );

    if (!subscription || !subscription.userID) {
      return res.status(404).json({
        message: "User or Subscription not found for this unit number",
      });
    }

    const response = {
      name: subscription.userID.name,
      unitNumber: subscription.userID.unitNumber,
      userSubscriptionType: subscription.userSubscriptionType,
      userPaymentMode: subscription.userPaymentMode,
      phoneNumber: subscription.userID.phoneNumber,
      userSubscriptionDate: subscription.userSubscriptionDate,
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// === Get All Pending Approvals ===
router.get("/getAllPendingApprovals", async (req, res) => {
  try {
    const results = await Subscription.find({ userSubscriptionStatus: "PEN" });

    const approvals = await Promise.all(
      results.map(async (sub) => {
        const user = await User.findOne({ unitNumber: sub.unitNumber });
        return {
          unitNumber: sub.unitNumber,
          name: user?.name || "Unknown",
          description: `${sub.userSubscriptionType} subscription`,
          status: sub.userSubscriptionStatus,
        };
      })
    );

    return res.status(200).json(approvals);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// === Get All Users with 'APR' Status ===
router.get("/getAllUsersWithApprStatusAPR", async (req, res) => {
  try {
    const users = await Subscription.find({ userSubscriptionStatus: "APR" });
    if (users.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found with status APR" });
    }
    return res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching APR users:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// === Get All Users with 'REJ' Status ===
router.get("/getAllUsersWithApprStatusREJ", async (req, res) => {
  try {
    const users = await Subscription.find({ userSubscriptionStatus: "REJ" });
    if (users.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found with status REJ" });
    }
    return res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching REJ users:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// === Update User Approval Status ===
router.put("/updateUserApprovalStatus", async (req, res) => {
  const { unitNumber, newStatus, updatedBy } = req.body;

  if (!unitNumber || !newStatus) {
    return res
      .status(400)
      .json({ message: "Both unitNumber and newStatus are required." });
  }

  if (!["APR", "REJ"].includes(newStatus)) {
    return res
      .status(400)
      .json({ message: "newStatus must be either 'APR' or 'REJ'." });
  }

  try {
    const updated = await Subscription.findOneAndUpdate(
      { unitNumber, userSubscriptionStatus: "PEN" },
      {
        userSubscriptionStatus: newStatus,
        userLastUpdatedDate: new Date(),
        userLastUpdatedBy: updatedBy || "admin",
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        message: "User with status 'PEN' not found for the given unitNumber.",
      });
    }

    return res.status(200).json({
      message: `User approval status updated to '${newStatus}' successfully.`,
      data: updated,
    });
  } catch (err) {
    console.error("Approval update error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
