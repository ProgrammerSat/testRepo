const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  unitNumber: { type: String, required: true, ref: "User" },
  userSubscriptionDate: { type: Date },
  userSubscriptionType: { type: String },
  userSubscriptionStatus: { type: String, enum: ["PEN", "APR", "REJ"] },
  userSessionYear: {
    type: Number,
    enum: [new Date().getFullYear()],
    default: new Date().getFullYear(),
  },
  userLastUpdatedDate: { type: Date, default: Date.now },
  userFmlyMemberCnt: { type: Number },
  userFmlyVegMemberCnt: { type: Number },

  // paymentMethod: {
  //   type: String,
  //   enum: ["UPI", "Cash", "Cheque", "Bank Transfer"],
  //   required: true,
  // },
  // isApproved: { type: Boolean, default: false },
  // createdAt: { type: Date, default: Date.now },

  userPaymentAmount: {
    type: Number,
  },
  userPaymentDate: {
    type: Date,
    default: Date.now,
  },
  userPaymentMode: {
    type: String,
    enum: ["UPI", "Cash", "Cheque", "Bank Transfer"],
    required: true,
  },
  userPaymentGivenTo: {
    type: String,
  },
  userChequeNumber: {
    type: Number,
  },
  userChequeBankName: {
    type: String,
  },
  userPaymentRefID: {
    type: String,
  },
  userTransfererBank: {
    type: String,
  },
  userPaymentImages: {
    type: [String],
    validate: {
      validator: function (arr) {
        return arr.length <= 1;
      },
      message: "Only one image per payment type is allowed.",
    },
  },
  userPaymentSubscriptionDesc: {
    type: String,
  },
  userLastUpdatedDate: {
    type: Date,
    default: Date.now,
  },
  userLastUpdatedBy: {
    type: String,
  },
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);
module.exports = Subscription;
