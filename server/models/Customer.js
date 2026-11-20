const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    businessName: {
      type: String,
      trim: true,
      default: '',
    },
    channel: {
      type: String,
      trim: true,
      default: '',
    },
    cnic: {
      type: String,
      trim: true,
      default: '',
    },
    ntn: {
      type: String,
      trim: true,
      default: '',
    },
    mobile: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    days: {
      type: String,
      trim: true,
      default: '',
    },
    creditLimit: {
      type: Number,
      default: null,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);
