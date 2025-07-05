const mongoose = require("mongoose");

//User Schema
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    unitNumber: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userRole: { type: String, enum: ["U01", "U02", "U03"] },
    userActive: { type: Boolean },
    userSecretCode: { type: Number, min: 1000, max: 9999, required: true },
    userCreationDate: { type: Date, default: Date.now, required: true },
    userSessionYear: {
      type: Number,
      enum: [new Date().getFullYear()],
      default: new Date().getFullYear(),
    },
    userSubscriptionStatus: {
      type: String,
      ref: "Subscription",
      enum: ["PEN", "APR", "REJ"],
    },
    subID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    userCpnActiveStatus: { type: Boolean, required: true },
    userLastUpdatedDate: { type: Date, default: Date.now },
    userLastUpdatedBy: { type: String, default: null },
  },
  {
    timestamps: {
      updatedAt: "updated_at",
    },
  }
);

const User = mongoose.model("User", userSchema);

module.exports = mongoose.model("User", userSchema);
