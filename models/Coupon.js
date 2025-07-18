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
  userSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subscription",
    required: true,
  },
  unitNumber: {
    type: String,
    ref: "User",
    required: true,
  },
  userCouponEvent: {
    type: String,
    enum: ["SAPTAMI", "ASTAMI", "NABAMI", "DASHAMI"],
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
    enum: ["Veg", "NonVeg"],
    required: true,
  },
  userCouponStatus: {
    type: String,
    enum: ["ACTIVE", "EXPIRED", "REDEEMED"],
    default: "ACTIVE",
  },
  userCouponValidFrom: {
    type: Date,
    required: true,
  },
  userCouponValidTo: {
    type: Date,
    required: true,
  },
  userCouponDineType: {
    type: String,
    enum: ["DINE-IN", "TAKE-AWAY"],
    required: true,
  },
  userLastUpdatedDate: {
    type: Date,
    default: Date.now,
  },
  userLastUpdatedBy: {
    type: String, // You can store user ID, admin ID, or name
  },
});

const Coupon = (module.exports = mongoose.model("Coupon", couponSchema));
module.exports = Coupon;
