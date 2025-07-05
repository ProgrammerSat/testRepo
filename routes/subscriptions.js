const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription");
const User = require("../models/User");

// Create subscription/payment entry
router.post("/create", async (req, res) => {
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
      userPaymentImages,
      userPaymentSubscriptionDesc,
    } = req.body;

    // Verify user exists
    const user = await User.findOne({ unitNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create subscription
    const newSub = new Subscription({
      userID,
      unitNumber,
      userSubscriptionStatus: "PEN",
      userSubscriptionDate: new Date(userSubscriptionDate) || new Date(),
      userSubscriptionType: userSubscriptionType,
      userPaymentAmount,
      userPaymentMode: userPaymentMode,
      userPaymentGivenTo,
      userChequeNumber,
      userChequeBankName,
      userPaymentRefID,
      userTransfererBank,
      userPaymentImages: userPaymentImages || "",
      userPaymentSubscriptionDesc,
      userSessionYear: new Date().getFullYear(),
    });

    await newSub.save();

    res.status(201).json({
      message: "Payment submitted successfully",
      subscription: newSub,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/checkSubscriptionStatus", async (req, res) => {
  const { unitNumber } = req.body;

  if (!unitNumber) {
    return res.status(400).json({ message: "unitNumber is required" });
  }

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

// POST or GET – adjust based on frontend
router.post("/getUserSubscriptionSummary", async (req, res) => {
  try {
    const { unitNumber } = req.body;

    if (!unitNumber) {
      return res.status(400).json({ message: "unitNumber is required" });
    }

    const subscription = await Subscription.findOne({ unitNumber }).populate(
      "userID"
    );

    if (!subscription || !subscription.userID) {
      return res.status(404).json({
        message: "User or Subscription not found for this unit number",
      });
    }

    // Return only selected fields
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

// Route to get all users with subscription status 'PEN'
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

// Route to get all users with subscription status 'APR'
router.get("/getAllUsersWithApprStatusAPR", async (req, res) => {
  try {
    const pendingUsers = await Subscription.find({
      userSubscriptionStatus: "APR",
    });

    if (pendingUsers.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found with status APR" });
    }

    return res.status(200).json(pendingUsers);
  } catch (err) {
    console.error("Error fetching users with status APR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Route to get all users with subscription status 'REJ'
router.get("/getAllUsersWithApprStatusREJ", async (req, res) => {
  try {
    const pendingUsers = await Subscription.find({
      userSubscriptionStatus: "REJ",
    });

    if (pendingUsers.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found with status REJ" });
    }

    return res.status(200).json(pendingUsers);
  } catch (err) {
    console.error("Error fetching users with status REJ:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Update user approval status (PEN → APR or REJ)
router.put("/updateUserApprovalStatus", async (req, res) => {
  const { unitNumber, newStatus, updatedBy } = req.body;

  if (!unitNumber || !newStatus) {
    return res.status(400).json({
      message: "Both unitNumber and newStatus are required.",
    });
  }

  if (!["APR", "REJ"].includes(newStatus)) {
    return res.status(400).json({
      message: "newStatus must be either 'APR' or 'REJ'.",
    });
  }

  try {
    const updated = await Subscription.findOneAndUpdate(
      { unitNumber, userSubscriptionStatus: "PEN" },
      {
        userSubscriptionStatus: newStatus,
        userLastUpdatedDate: new Date(),
        userLastUpdatedBy: updatedBy || "admin", // optional tracking
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
  } catch (error) {
    console.error("Approval update error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
