const express = require("express");
const router = express.Router();
const Coupon = require("../models/Coupon");
const User = require("../models/User");
const Subscription = require("../models/Subscription");

// Update userCouponTakeAwayStatus
router.post("/updateTakeAwayStatus", async (req, res) => {
  const { couponId, action } = req.body;
  // action can be 'request' (NA->PENDING), 'approve', or 'reject' (PENDING->APPROVED/REJECTED)
  if (!couponId || !action) {
    return res.status(400).json({ error: "couponId and action are required" });
  }
  try {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }
    if (action === "request") {
      if (coupon.userCouponRedeemStatus !== "TAKE-AWAY") {
        return res.status(400).json({
          error: "Dine type must be TAKE-AWAY to request take-away status",
        });
      }
      if (coupon.userCouponTakeAwayStatus !== "NA") {
        return res.status(400).json({
          error: "Take-away status can only be set to PENDING from NA",
        });
      }
      coupon.userCouponTakeAwayStatus = "PENDING";
    } else if (action === "approve") {
      if (coupon.userCouponTakeAwayStatus !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Can only approve a PENDING take-away request" });
      }
      coupon.userCouponTakeAwayStatus = "APPROVED";
    } else if (action === "reject") {
      if (coupon.userCouponTakeAwayStatus !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Can only reject a PENDING take-away request" });
      }
      coupon.userCouponTakeAwayStatus = "REJECTED";
    } else {
      return res.status(400).json({
        error: "Invalid action. Use 'request', 'approve', or 'reject'",
      });
    }
    await coupon.save();
    return res
      .status(200)
      .json({ message: "Take-away status updated", coupon });
  } catch (err) {
    console.error("Error updating take-away status:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

// Get all coupons with userCouponRedeemStatus as TAKE-AWAY
router.get("/getAllTakeAwayCoupons", async (req, res) => {
  try {
    const coupons = await Coupon.find({
      userCouponRedeemStatus: "TAKE-AWAY",
      userCouponTakeAwayStatus: { $ne: "NA" },
    });
    return res.status(200).json({
      message:
        "All TAKE-AWAY coupons (excluding status 'NA') fetched successfully",
      total: coupons.length,
      coupons,
    });
  } catch (err) {
    console.error("Error fetching TAKE-AWAY coupons:", err);
    return res.status(500).json({
      error: "Server error while fetching TAKE-AWAY coupons",
      details: err.message,
    });
  }
});

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
      userCouponStatus,
      userCouponRedeemStatus,
      userCouponTakeAwayStatus,
      userCouponValidFrom,
      userCouponValidTo,
      userLastUpdatedBy,
    } = req.body;

    // Validate required fields
    if (
      !couponNomenclature ||
      !userId ||
      !unitNumber ||
      !userCouponEvent ||
      !userCouponSubEvent ||
      !userCouponTakeAwayStatus ||
      !userCouponStatus ||
      !userCouponRedeemStatus ||
      !userCouponValidFrom ||
      !userCouponValidTo
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newCoupon = new Coupon({
      couponNomenclature,
      userId,
      unitNumber,
      userCouponEvent,
      userCouponSubEvent,
      userCouponStatus,
      userCouponRedeemStatus,
      userCouponTakeAwayStatus,
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

// redeemCoupon
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

    if (coupon.userCouponStatus === "EXPIRED") {
      return res
        .status(400)
        .json({ error: "Coupon is expired and cannot be redeemed" });
    }

    if (coupon.userCouponValidFrom > new Date()) {
      return res.status(400).json({
        error: "Coupon is not valid yet",
      });
    }

    // If already redeemed, allow changing between DINE-IN and TAKE-AWAY
    if (coupon.userCouponStatus === "REDEEMED") {
      if (
        (coupon.userCouponRedeemStatus === "DINE-IN" && mode === "TAKE-AWAY") ||
        (coupon.userCouponRedeemStatus === "TAKE-AWAY" && mode === "DINE-IN")
      ) {
        coupon.userCouponRedeemStatus = mode;
        coupon.userLastUpdatedBy = updatedBy;
        coupon.userLastUpdatedDate = new Date();

        // Update take-away status accordingly
        if (mode === "TAKE-AWAY" && coupon.userCouponTakeAwayStatus === "NA") {
          coupon.userCouponTakeAwayStatus = "PENDING";
        } else if (mode === "DINE-IN") {
          coupon.userCouponTakeAwayStatus = "NA";
        }

        const updatedCoupon = await coupon.save();
        return res.status(200).json({
          message: `Coupon dine type updated to ${mode}`,
          coupon: updatedCoupon,
        });
      } else {
        return res.status(400).json({
          error:
            "Coupon already redeemed. Only DINE-IN <-> TAKE-AWAY change allowed.",
        });
      }
    }

    // Normal redeem flow
    coupon.userCouponStatus = "REDEEMED";
    coupon.userCouponRedeemStatus = mode;
    coupon.userLastUpdatedBy = updatedBy;
    coupon.userLastUpdatedDate = new Date();

    // Update take-away status accordingly
    if (mode === "TAKE-AWAY" && coupon.userCouponTakeAwayStatus === "NA") {
      coupon.userCouponTakeAwayStatus = "PENDING";
    } else if (mode === "DINE-IN") {
      coupon.userCouponTakeAwayStatus = "NA";
    }

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

    const grouped = {};

    coupons.forEach((coupon) => {
      const subEvent = coupon.userCouponSubEvent || "OTHER";
      if (!grouped[subEvent]) {
        grouped[subEvent] = [];
      }
      grouped[subEvent].push(coupon);
    });

    return res.status(200).json(grouped);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

// Redeem all BREAKFAST coupons
router.post("/redeemAllBreakfastCoupons", async (req, res) => {
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

    // Find all ACTIVE BREAKFAST coupons
    const coupons = await Coupon.find({
      userId: user._id,
      userCouponSubEvent: "BREAKFAST",
      userCouponStatus: "ACTIVE",
    });

    if (coupons.length === 0) {
      return res
        .status(404)
        .json({ error: "No active breakfast coupons found" });
    }

    // Redeem each coupon
    const updatedCoupons = await Promise.all(
      coupons.map(async (coupon) => {
        coupon.userCouponStatus = "REDEEMED";
        coupon.userLastUpdatedBy = updatedBy;
        coupon.userLastUpdatedDate = new Date();
        if (
          coupon.userCouponRedeemStatus === "TAKE-AWAY" &&
          coupon.userCouponTakeAwayStatus === "NA"
        ) {
          coupon.userCouponTakeAwayStatus = "PENDING";
        } else if (coupon.userCouponRedeemStatus === "DINE-IN") {
          coupon.userCouponTakeAwayStatus = "NA";
        }
        return await coupon.save();
      })
    );

    return res.status(200).json({
      message: "All active breakfast coupons redeemed successfully",
      totalRedeemed: updatedCoupons.length,
      coupons: updatedCoupons,
    });
  } catch (err) {
    console.error("Error redeeming breakfast coupons:", err);
    return res.status(500).json({
      error: "Server error while redeeming breakfast coupons",
      details: err.message,
    });
  }
});

// Redeem all LUNCH coupons
router.post("/redeemAllLunchCoupons", async (req, res) => {
  const { unitNumber, updatedBy } = req.body;

  if (!unitNumber || !updatedBy) {
    return res
      .status(400)
      .json({ error: "unitNumber and updatedBy are required" });
  }

  try {
    const user = await User.findOne({ unitNumber });
    if (!user) return res.status(404).json({ error: "User not found" });

    const coupons = await Coupon.find({
      userId: user._id,
      userCouponStatus: "ACTIVE",
      userCouponSubEvent: "LUNCH",
    });

    if (coupons.length === 0) {
      return res.status(404).json({ error: "No active LUNCH coupons found" });
    }

    const updated = await Promise.all(
      coupons.map((coupon) => {
        coupon.userCouponStatus = "REDEEMED";
        coupon.userLastUpdatedBy = updatedBy;
        coupon.userLastUpdatedDate = new Date();
        if (
          coupon.userCouponRedeemStatus === "TAKE-AWAY" &&
          coupon.userCouponTakeAwayStatus === "NA"
        ) {
          coupon.userCouponTakeAwayStatus = "PENDING";
        } else if (coupon.userCouponRedeemStatus === "DINE-IN") {
          coupon.userCouponTakeAwayStatus = "NA";
        }
        return coupon.save();
      })
    );

    return res.status(200).json({
      message: "All LUNCH coupons redeemed successfully",
      coupons: updated,
    });
  } catch (err) {
    console.error("Error redeeming LUNCH coupons:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

// Redeem all DINNER coupons
router.post("/redeemAllDinnerCoupons", async (req, res) => {
  const { unitNumber, updatedBy } = req.body;

  if (!unitNumber || !updatedBy) {
    return res
      .status(400)
      .json({ error: "unitNumber and updatedBy are required" });
  }

  try {
    const user = await User.findOne({ unitNumber });
    if (!user) return res.status(404).json({ error: "User not found" });

    const coupons = await Coupon.find({
      userId: user._id,
      userCouponStatus: "ACTIVE",
      userCouponSubEvent: "DINNER",
    });

    if (coupons.length === 0) {
      return res.status(404).json({ error: "No active DINNER coupons found" });
    }

    const updated = await Promise.all(
      coupons.map((coupon) => {
        coupon.userCouponStatus = "REDEEMED";
        coupon.userLastUpdatedBy = updatedBy;
        coupon.userLastUpdatedDate = new Date();
        if (
          coupon.userCouponRedeemStatus === "TAKE-AWAY" &&
          coupon.userCouponTakeAwayStatus === "NA"
        ) {
          coupon.userCouponTakeAwayStatus = "PENDING";
        } else if (coupon.userCouponRedeemStatus === "DINE-IN") {
          coupon.userCouponTakeAwayStatus = "NA";
        }
        return coupon.save();
      })
    );

    return res.status(200).json({
      message: "All DINNER coupons redeemed successfully",
      coupons: updated,
    });
  } catch (err) {
    console.error("Error redeeming DINNER coupons:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

router.get("/getAllCouponUnitNumbers", async (req, res) => {
  try {
    // Get distinct unitNumbers from Coupon collection
    const unitNumbers = await Coupon.distinct("unitNumber");

    return res.status(200).json({
      message: "Unit numbers retrieved successfully",
      unitNumbers,
    });
  } catch (err) {
    console.error("Error retrieving unit numbers:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
});

// Verify Secret Code for a Unit Number
router.post("/verifySecretCode", async (req, res) => {
  const { unitNumber, userSecretCode } = req.body;

  if (!unitNumber || !userSecretCode) {
    return res.status(400).json({
      error: "unitNumber and secretCode are required",
    });
  }

  try {
    const user = await User.findOne({ unitNumber });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.userSecretCode === userSecretCode) {
      return res.status(200).json({
        message: "Secret code verified successfully",
        verified: true,
      });
    } else {
      return res.status(401).json({
        message: "Secret code does not match",
        verified: false,
      });
    }
  } catch (err) {
    console.error("Error verifying secret code:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

router.get("/dashboard/:unitNumber", async (req, res) => {
  const { unitNumber } = req.params;

  if (!unitNumber) {
    return res.status(400).json({ message: "unitNumber is required" });
  }

  try {
    const coupons = await Coupon.find({ unitNumber });

    const data = {};

    coupons.forEach((coupon) => {
      const event = coupon.userCouponEvent;
      const subEvent = coupon.userCouponSubEvent;

      if (!data[event]) {
        data[event] = {};
      }

      if (!data[event][subEvent]) {
        data[event][subEvent] = {
          totalCoupons: 0,
          redeemed: 0,
          expired: 0,
          takeAwayApproved: 0,
          validFrom: coupon.userCouponValidFrom,
          validTo: coupon.userCouponValidTo,
        };
      }

      data[event][subEvent].totalCoupons += 1;

      if (coupon.userCouponStatus === "REDEEMED") {
        data[event][subEvent].redeemed += 1;
      }

      if (coupon.userCouponStatus === "EXPIRED") {
        data[event][subEvent].expired += 1;
      }

      if (coupon.userCouponTakeAwayStatus === "APPROVED") {
        data[event][subEvent].takeAwayApproved += 1;
      }

      // Ensure validFrom and validTo are the earliest and latest
      data[event][subEvent].validFrom = new Date(
        Math.min(
          new Date(data[event][subEvent].validFrom),
          new Date(coupon.userCouponValidFrom)
        )
      );

      data[event][subEvent].validTo = new Date(
        Math.max(
          new Date(data[event][subEvent].validTo),
          new Date(coupon.userCouponValidTo)
        )
      );
    });

    res.json(data);
  } catch (err) {
    console.error("Error getting dashboard data:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/checkCouponsBySubEvent", async (req, res) => {
  const { unitNumber, userCouponEvent, userCouponSubEvent } = req.body;

  if (!unitNumber || !userCouponEvent || !userCouponSubEvent) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const currentISTTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const coupons = await Coupon.find({
      unitNumber,
      userCouponEvent,
      userCouponSubEvent,
    });

    let updatedCount = 0;

    for (const coupon of coupons) {
      const validFromIST = new Date(
        new Date(coupon.userCouponValidFrom).toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
        })
      );
      const validToIST = new Date(
        new Date(coupon.userCouponValidTo).toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
        })
      );

      if (coupon.userCouponStatus !== "REDEEMED") {
        const shouldBeActive = validFromIST < currentISTTime;
        const newStatus = shouldBeActive ? "ACTIVE" : coupon.userCouponStatus;
        coupon.userCouponStatus = newStatus;
        await coupon.save();
        updatedCount++;
      }
      if (
        coupon.userCouponStatus === "ACTIVE" &&
        validFromIST > currentISTTime
      ) {
        coupon.userCouponStatus = "PENDING";
        await coupon.save();
        updatedCount++;
      }
      if (validToIST < currentISTTime && coupon.userCouponStatus === "ACTIVE") {
        coupon.userCouponStatus = "EXPIRED";
        await coupon.save();
        updatedCount++;
      }
      if (coupon.userCouponStatus === "EXPIRED") {
        if (
          coupon.userCouponRedeemStatus !== "NA" ||
          coupon.userCouponTakeAwayStatus !== "NA"
        ) {
          coupon.userCouponStatus = "REDEEMED";
          await coupon.save();
          updatedCount++;
        }
      }
    }

    return res.json({
      success: true,
      message: `Checked ${coupons.length} coupon(s), updated ${updatedCount}.`,
      count: coupons.length,
      updatedCount,
      exists: coupons.length > 0,
    });
  } catch (error) {
    console.error("Error checking coupons:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/checkAndUpdateCouponStatuses", async (req, res) => {
  const { unitNumber } = req.body;

  if (!unitNumber) {
    return res.status(400).json({ error: "unitNumber is required." });
  }

  try {
    const currentISTTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const coupons = await Coupon.find({ unitNumber });

    let updatedCount = 0;

    for (const coupon of coupons) {
      // Skip already redeemed coupons
      if (coupon.userCouponStatus === "REDEEMED") continue;

      const validFromIST = new Date(
        new Date(coupon.userCouponValidFrom).toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
        })
      );
      const validToIST = new Date(
        new Date(coupon.userCouponValidTo).toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
        })
      );

      let updated = false;

      // If validFrom passed and status is PENDING → make ACTIVE
      if (
        validFromIST <= currentISTTime &&
        coupon.userCouponStatus === "PENDING"
      ) {
        coupon.userCouponStatus = "ACTIVE";
        updated = true;
      }

      if (
        validToIST < currentISTTime &&
        coupon.userCouponStatus === "PENDING"
      ) {
        coupon.userCouponStatus = "EXPIRED";
        updated = true;
      }

      if (
        validToIST > currentISTTime &&
        coupon.userCouponStatus === "EXPIRED"
      ) {
        coupon.userCouponStatus = "ACTIVE";
        updated = true;
      }

      // If validFrom passed and status is ACTIVE → make PENDING
      if (
        validFromIST > currentISTTime &&
        coupon.userCouponStatus === "ACTIVE"
      ) {
        coupon.userCouponStatus = "PENDING";
        updated = true;
      }

      // If validTo passed and status is ACTIVE → make EXPIRED
      if (validToIST < currentISTTime && coupon.userCouponStatus === "ACTIVE") {
        coupon.userCouponStatus = "EXPIRED";
        updated = true;
      }

      if (updated) {
        await coupon.save();
        updatedCount++;
      }
    }

    return res.json({
      success: true,
      message: `Checked ${coupons.length} coupon(s), updated ${updatedCount}.`,
      count: coupons.length,
      updatedCount,
    });
  } catch (error) {
    console.error("Error updating coupon statuses:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/eodreports", async (req, res) => {
  try {
    const { eventDay } = req.body;

    if (!eventDay) {
      return res.status(400).json({ error: "eventDay is required" });
    }

    const subEvents = ["BREAKFAST", "LUNCH", "DINNER"];
    const report = {};

    for (const subEvent of subEvents) {
      const [dineIn, takeAway, expired] = await Promise.all([
        Coupon.countDocuments({
          userCouponEvent: eventDay,
          userCouponSubEvent: subEvent,
          userCouponRedeemStatus: "DINE-IN",
        }),
        Coupon.countDocuments({
          userCouponEvent: eventDay,
          userCouponSubEvent: subEvent,
          userCouponRedeemStatus: "TAKE-AWAY",
        }),
        Coupon.countDocuments({
          userCouponEvent: eventDay,
          userCouponSubEvent: subEvent,
          userCouponStatus: "EXPIRED",
        }),
      ]);

      report[subEvent] = {
        "dine-in": dineIn,
        "take-away": takeAway,
        expired,
      };
    }

    res.json({ eventDay, report });
  } catch (err) {
    console.error("Error generating EOD report:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /redeemMultipleCoupons
router.post("/redeemMultipleCoupons", async (req, res) => {
  const { couponIds, mode, updatedBy } = req.body;

  if (
    !Array.isArray(couponIds) ||
    couponIds.length === 0 ||
    !mode ||
    !updatedBy
  ) {
    return res.status(400).json({
      error: "couponIds (array), mode, and updatedBy are required",
    });
  }

  if (!["DINE-IN", "TAKE-AWAY"].includes(mode)) {
    return res.status(400).json({
      error: "Invalid mode. Must be 'DINE-IN' or 'TAKE-AWAY'",
    });
  }

  try {
    // Fetch all coupons that need to be redeemed
    const coupons = await Coupon.find({
      _id: { $in: couponIds },
      userCouponStatus: { $ne: "REDEEMED" }, // Only redeem those not already redeemed
    });

    if (coupons.length === 0) {
      return res
        .status(404)
        .json({ error: "No valid coupons to redeem found among provided IDs" });
    }

    // Update coupons accordingly
    for (let coupon of coupons) {
      coupon.userCouponStatus = "REDEEMED";
      coupon.userCouponRedeemStatus = mode;
      coupon.userLastUpdatedBy = updatedBy;
      coupon.userLastUpdatedDate = new Date();

      if (mode === "TAKE-AWAY") {
        coupon.userCouponTakeAwayStatus = "PENDING";
      } else if (mode === "DINE-IN") {
        coupon.userCouponTakeAwayStatus = "NA";
      }

      await coupon.save();
    }

    return res.status(200).json({
      message: `${coupons.length} coupons redeemed successfully`,
      redeemedCoupons: coupons,
    });
  } catch (err) {
    console.error("Error redeeming multiple coupons:", err);
    return res.status(500).json({
      error: "Server error during multiple coupon redemption",
      details: err.message,
    });
  }
});

module.exports = router;
