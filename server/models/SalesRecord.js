const mongoose = require('mongoose');

const salesRecordSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      trim: true,
    },
    invoiceType: {
      type: String,
      trim: true,
      default: '',
    },
    invoiceDate: {
      type: Date,
      default: null,
    },
    buyerNtnCnic: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    buyerBusinessName: {
      type: String,
      trim: true,
      default: '',
    },
    buyerBusinessNameNormalized: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    buyerProvince: {
      type: String,
      trim: true,
      default: '',
    },
    buyerAddress: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      default: null,
    },
    customerId: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    period: {
      type: String,
      trim: true,
      default: '',
    },
    periodSortKey: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

salesRecordSchema.index(
  { invoiceId: 1 },
  {
    unique: true,
    partialFilterExpression: { invoiceId: { $type: 'string', $gt: '' } },
  }
);

salesRecordSchema.index(
  { customerId: 1, period: 1 },
  {
    unique: true,
    partialFilterExpression: {
      customerId: { $type: 'string', $gt: '' },
      period: { $type: 'string', $gt: '' },
    },
  }
);

module.exports = mongoose.model('SalesRecord', salesRecordSchema);
