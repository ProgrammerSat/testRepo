const express = require("express");
const router = express.Router();
const Coupon = require("../models/Coupon");
const User = require("../models/User");

//upload Coupons
//Get Call to get Coupon details
router.post("/getCoupons", async (req, res) => {
  const { unitNumber } = req.body;
  if (!unitNumber) {
    return res.status(400).json({ error: "unitNumber is required" });
  }
  try {
    // Find the user by unitNumber
    const user = await User.findOne({ unitNumber });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Find coupons for this user
    const coupons = await Coupon.find({ userId: user._id });
    return res.status(200).json({ coupons });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

router.post("/createCoupon", async (req, res) => {
  try {
    const {
      couponNomenclature,
      userId,
      userSubscriptionId,
      unitNumber,
      userCouponEvent,
      userCouponSubEvent,
      userCouponMealType,
      userCouponDineType,
      userCouponValidFrom,
      userCouponValidTo,
      userLastUpdatedBy,
    } = req.body;

    // Validate required fields
    if (
      !couponNomenclature ||
      !userId ||
      !userSubscriptionId ||
      !unitNumber ||
      !userCouponEvent ||
      !userCouponSubEvent ||
      !userCouponMealType ||
      !userCouponDineType ||
      !userCouponValidFrom ||
      !userCouponValidTo
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newCoupon = new Coupon({
      couponNomenclature,
      userId,
      userSubscriptionId,
      unitNumber,
      userCouponEvent,
      userCouponSubEvent,
      userCouponMealType,
      userCouponDineType,
      userCouponValidFrom: new Date(userCouponValidFrom),
      userCouponValidTo: new Date(userCouponValidTo),
      userLastUpdatedBy,
    });

    const savedCoupon = await newCoupon.save();

    return res.status(201).json({
      message: "Coupon created successfully",
      coupon: savedCoupon,
    });
  } catch (err) {
    console.error("Error creating coupon:", err);
    return res.status(500).json({
      message: "Server error while creating coupon",
      error: err.message,
    });
  }
});

//redeemCoupon
router.post("/redeemCoupon", async (req, res) => {
  const { couponId, mode, updatedBy } = req.body;

  if (!couponId || !mode || !updatedBy) {
    return res.status(400).json({
      error: "couponId, mode, and updatedBy are required",
    });
  }

  if (!["DINE-IN", "TAKE-AWAY"].includes(mode)) {
    return res.status(400).json({
      error: "Invalid dine mode. Must be 'DINE-IN' or 'TAKE-AWAY'",
    });
  }

  try {
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    if (coupon.userCouponStatus === "REDEEMED") {
      return res.status(400).json({ error: "Coupon already redeemed" });
    }

    if (coupon.userCouponStatus === "EXPIRED") {
      return res
        .status(400)
        .json({ error: "Coupon is expired and cannot be redeemed" });
    }

    // Update coupon status and dine type
    coupon.userCouponStatus = "REDEEMED";
    coupon.userCouponDineType = mode;
    coupon.userLastUpdatedBy = updatedBy;
    coupon.userLastUpdatedDate = new Date();

    const updatedCoupon = await coupon.save();

    return res.status(200).json({
      message: "Coupon redeemed successfully",
      coupon: updatedCoupon,
    });
  } catch (err) {
    console.error("Error redeeming coupon:", err);
    return res.status(500).json({
      error: "Server error while redeeming coupon",
      details: err.message,
    });
  }
});

// POST /getUserCoupons
router.post("/getUserCoupons", async (req, res) => {
  const { unitNumber } = req.body;

  if (!unitNumber) {
    return res.status(400).json({ error: "unitNumber is required" });
  }

  try {
    // Find user by unit number
    const user = await User.findOne({ unitNumber });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get all coupons for this user
    const coupons = await Coupon.find({ userId: user._id }).sort({
      userCouponValidFrom: 1,
    });

    return res.status(200).json({
      message: "Coupons fetched successfully",
      unitNumber,
      userId: user._id,
      totalCoupons: coupons.length,
      coupons,
    });
  } catch (err) {
    console.error("Error fetching user coupons:", err);
    return res.status(500).json({
      error: "Server error while fetching coupons",
      details: err.message,
    });
  }
});

router.post("/redeemAllCoupons", async (req, res) => {
  const { unitNumber, updatedBy } = req.body;

  if (!unitNumber || !updatedBy) {
    return res
      .status(400)
      .json({ error: "unitNumber and updatedBy are required" });
  }

  try {
    // Find user by unit number
    const user = await User.findOne({ unitNumber });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find all active coupons for this user
    const coupons = await Coupon.find({
      userId: user._id,
      userCouponStatus: "ACTIVE",
    });

    if (coupons.length === 0) {
      return res
        .status(404)
        .json({ error: "No active coupons found for this user" });
    }

    // Redeem all active coupons
    const updatedCoupons = await Promise.all(
      coupons.map(async (coupon) => {
        coupon.userCouponStatus = "REDEEMED";
        coupon.userLastUpdatedBy = updatedBy;
        coupon.userLastUpdatedDate = new Date();
        return await coupon.save();
      })
    );

    return res.status(200).json({
      message: "All active coupons redeemed successfully",
      coupons: updatedCoupons,
    });
  } catch (err) {
    console.error("Error redeeming all coupons:", err);
    return res.status(500).json({
      error: "Server error while redeeming all coupons",
      details: err.message,
    });
  }
});

router.post("/getEventCoupons", async (req, res) => {
  const { unitNumber, userCouponEvent } = req.body;

  if (!unitNumber || !userCouponEvent) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const user = await User.findOne({ unitNumber });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const coupons = await Coupon.find({
      userId: user._id,
      userCouponEvent,
    });

    const grouped = {
      BREAKFAST: [],
      LUNCH: [],
      DINNER: [],
    };

    for (const coupon of coupons) {
      if (grouped[coupon.userCouponSubEvent]) {
        grouped[coupon.userCouponSubEvent].push(coupon);
      }
    }

    return res.status(200).json(grouped);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
