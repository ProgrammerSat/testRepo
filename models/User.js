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
    userSubType: {
      type: String,
      enum: ["NA", "2-MEM-SUB", "4-MEM-SUB", "6-MEM-SUB"],
      default: "NA",
      required: true,
    },
    userSubPaid: { type: Boolean, default: false, required: true },
    userPaidAmt: { type: Number, default: 0, required: true },
    userCpnActiveStatus: { type: Boolean, required: false },
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
