const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  couponNomenclature: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  unitNumber: {
    type: String,
    ref: "User",
    required: true,
  },
  userCouponEvent: {
    type: String,
    enum: ["SAPTAMI", "ASHTAMI", "NABAMI", "DASHAMI"],
    required: true,
  },
  userCouponSubEvent: {
    type: String,
    enum: ["BREAKFAST", "LUNCH", "DINNER"],
    required: true,
  },
  sessionYear: {
    type: Number,
    enum: [new Date().getFullYear()], // only allows current year (e.g., 2025)
    default: new Date().getFullYear(),
    required: true,
  },
  userCouponMealType: {
    type: String,
    enum: ["NA", "Veg", "NonVeg"],
    default: "NA", // Default to "NA" if not specified
    required: true,
  },
  userCouponStatus: {
    type: String,
    enum: ["PENDING", "ACTIVE", "EXPIRED", "REDEEMED"],
    default: "PENDING",
  },
  userCouponValidFrom: {
    type: Date,
    required: true,
  },
  userCouponValidTo: {
    type: Date,
    required: true,
  },
  userCouponRedeemStatus: {
    type: String,
    enum: ["NA", "DINE-IN", "TAKE-AWAY"],
    default: "NA", // Default to "NA" if not specified
    required: true,
  },
  userLastUpdatedDate: {
    type: Date,
    default: Date.now,
  },
  userLastUpdatedBy: {
    type: String, // You can store user ID, admin ID, or name
  },
  userCouponTakeAwayStatus: {
    type: String,
    enum: ["NA", "APPROVED", "PENDING", "REJECTED"],
    default: "NA",
  },
});

const Coupon = (module.exports = mongoose.model("Coupon", couponSchema));
module.exports = Coupon;
