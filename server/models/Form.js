const mongoose = require('mongoose');

const CHANNELS = ['S.D', 'W.S', 'Retail', 'Key accounts'];
const CHEQUE_STATUSES = ['Yes', 'No'];
const CREDIT_TYPES = ['Increment', 'Decrement', 'New', 'Closure'];

const commentSchema = new mongoose.Schema(
  {
    role: {
      type: Number,
      required: true,
      enum: [2, 3, 4],
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    action: {
      type: String,
      required: true,
      enum: ['APPROVED', 'REJECTED'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const formSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    cName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    bName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    shopPicture: {
      type: String,
      required: true,
    },
    channel: {
      type: String,
      required: true,
      enum: CHANNELS,
    },
    cnicNo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    ntnNo: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    mobileNo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    days: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    creditLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    chequeStatus: {
      type: String,
      required: true,
      enum: CHEQUE_STATUSES,
    },
    chequeNo: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    chequeAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    chequePicture: {
      type: String,
      default: '',
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    bankBranch: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    creditType: {
      type: String,
      required: true,
      enum: CREDIT_TYPES,
    },
    currentStage: {
      type: Number,
      required: true,
      enum: [2, 3, 4, 5],
      default: 2,
    },
    status: {
      type: String,
      required: true,
      enum: ['INCOMPLETE', 'APPROVED', 'REJECTED'],
      default: 'INCOMPLETE',
    },
    isUpdated: {
      type: Boolean,
      default: false,
    },
    comments: {
      type: [commentSchema],
      default: [],
    },
    creditSentAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Number,
      default: 1,
      immutable: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Form', formSchema);
module.exports.CHANNELS = CHANNELS;
module.exports.CHEQUE_STATUSES = CHEQUE_STATUSES;
module.exports.CREDIT_TYPES = CREDIT_TYPES;
