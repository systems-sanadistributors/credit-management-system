const zlib = require('zlib');
const { connectDB, disconnectDB } = require('./config/db');
const Form = require('./models/Form');
const r2Service = require('./services/r2Service');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createSamplePngDataUrl(bgRgb, accentRgb) {
  const width = 240;
  const height = 140;
  const raw = Buffer.alloc((width * 3 + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      const isBorder = x < 8 || x >= width - 8 || y < 8 || y >= height - 8;
      const isBand = y >= 22 && y <= 46 && x >= 18 && x <= width - 18;
      const isLine = (y === 70 || y === 92 || y === 112) && x >= 18 && x <= width - 48;
      const color = isBorder || isBand || isLine ? accentRgb : bgRgb;
      raw[px] = color[0];
      raw[px + 1] = color[1];
      raw[px + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  return `data:image/png;base64,${png.toString('base64')}`;
}

async function resolveImage(dataUrl, folder) {
  try {
    return await r2Service.uploadImage(dataUrl, folder);
  } catch (err) {
    console.warn(`[SEED] R2 upload fallback to data URL (${err.message})`);
    return dataUrl;
  }
}

async function runSeed() {
  await connectDB();

  const shopImgA = await resolveImage(
    createSamplePngDataUrl([244, 244, 245], [24, 24, 27]),
    'sana-Distributors/shops'
  );
  const shopImgB = await resolveImage(
    createSamplePngDataUrl([236, 253, 245], [6, 95, 70]),
    'sana-Distributors/shops'
  );
  const chequeImg = await resolveImage(
    createSamplePngDataUrl([255, 251, 235], [146, 64, 14]),
    'sana-Distributors/cheques'
  );

  const now = Date.now();
  const minsAgo = (m) => new Date(now - m * 60 * 1000);

  const records = [
    {
      title: 'Tariq Mahmood — Al-Noor Pharmacy',
      cName: 'Tariq Mahmood',
      bName: 'Al-Noor Pharmacy',
      shopPicture: shopImgA,
      channel: 'Retail',
      cnicNo: '35202-4411223-1',
      ntnNo: '4455112-3',
      mobileNo: '0300-4112233',
      address: 'Shop 12, Main Boulevard, Gulberg III, Lahore',
      days: '30',
      creditLimit: 500000,
      chequeStatus: 'Yes',
      chequeNo: 'CHQ-884120',
      chequeAmount: 500000,
      chequePicture: chequeImg,
      creditType: 'New',
      currentStage: 5,
      status: 'APPROVED',
      isUpdated: false,
      comments: [
        { role: 2, comment: 'Shop front and security cheque verified.', action: 'APPROVED', createdAt: minsAgo(180) },
        { role: 3, comment: 'CNIC and NTN records matched.', action: 'APPROVED', createdAt: minsAgo(120) },
        { role: 4, comment: 'Final approval granted for 30 days credit.', action: 'APPROVED', createdAt: minsAgo(60) },
      ],
    },
    {
      title: 'Usman Ali — Sana Key Accounts Hub',
      cName: 'Usman Ali',
      bName: 'Sana Key Accounts Hub',
      shopPicture: shopImgB,
      channel: 'Key accounts',
      cnicNo: '42101-7654321-3',
      ntnNo: '8877665-1',
      mobileNo: '0321-9876543',
      address: 'Suite 9, Shahrah-e-Faisal, Karachi',
      days: '45',
      creditLimit: 1200000,
      chequeStatus: 'No',
      chequeNo: '',
      chequeAmount: null,
      chequePicture: '',
      creditType: 'Increment',
      currentStage: 5,
      status: 'APPROVED',
      isUpdated: false,
      comments: [
        { role: 2, comment: 'Outlet inspection passed.', action: 'APPROVED', createdAt: minsAgo(240) },
        { role: 3, comment: 'Previous payment history clear.', action: 'APPROVED', createdAt: minsAgo(200) },
        { role: 4, comment: 'Approved limit increment to 1.2M.', action: 'APPROVED', createdAt: minsAgo(150) },
      ],
    },
    {
      title: 'Kamran Siddiqui — Metro Care Mart',
      cName: 'Kamran Siddiqui',
      bName: 'Metro Care Mart',
      shopPicture: shopImgA,
      channel: 'W.S',
      cnicNo: '61101-3344556-7',
      ntnNo: '3322110-9',
      mobileNo: '0333-5544332',
      address: 'Plot 7, Sector I-9 Industrial Area, Islamabad',
      days: '30',
      creditLimit: 800000,
      chequeStatus: 'Yes',
      chequeNo: 'CHQ-119044',
      chequeAmount: 800000,
      chequePicture: chequeImg,
      creditType: 'New',
      currentStage: 2,
      status: 'INCOMPLETE',
      isUpdated: false,
      comments: [],
    },
    {
      title: 'Bilal Khan — Khan Medicos',
      cName: 'Bilal Khan',
      bName: 'Khan Medicos',
      shopPicture: shopImgB,
      channel: 'S.D',
      cnicNo: '17301-8877665-5',
      ntnNo: '5544332-1',
      mobileNo: '0345-9988776',
      address: 'G.T. Road, Saddar Bazaar, Peshawar',
      days: '60',
      creditLimit: 650000,
      chequeStatus: 'No',
      chequeNo: '',
      chequeAmount: null,
      chequePicture: '',
      creditType: 'Increment',
      currentStage: 2,
      status: 'INCOMPLETE',
      isUpdated: true,
      comments: [],
    },
    {
      title: 'Farhan Ahmed — Crescent Distributors',
      cName: 'Farhan Ahmed',
      bName: 'Crescent Distributors',
      shopPicture: shopImgA,
      channel: 'S.D',
      cnicNo: '36302-5566778-9',
      ntnNo: '6677889-4',
      mobileNo: '0301-6677889',
      address: 'Abdali Road, Multan Cantt',
      days: '30',
      creditLimit: 450000,
      chequeStatus: 'No',
      chequeNo: '',
      chequeAmount: null,
      chequePicture: '',
      creditType: 'Decrement',
      currentStage: 3,
      status: 'INCOMPLETE',
      isUpdated: false,
      comments: [
        { role: 2, comment: 'Verified shop status and current balance.', action: 'APPROVED', createdAt: minsAgo(45) },
      ],
    },
    {
      title: 'Sadia Malik — Prime Health Retail',
      cName: 'Sadia Malik',
      bName: 'Prime Health Retail',
      shopPicture: shopImgB,
      channel: 'Retail',
      cnicNo: '35201-2233445-2',
      ntnNo: '7788990-2',
      mobileNo: '0312-2233445',
      address: 'Block H, DHA Phase 2, Lahore',
      days: '45',
      creditLimit: 950000,
      chequeStatus: 'Yes',
      chequeNo: 'CHQ-552211',
      chequeAmount: 950000,
      chequePicture: chequeImg,
      creditType: 'New',
      currentStage: 4,
      status: 'INCOMPLETE',
      isUpdated: false,
      comments: [
        { role: 2, comment: 'Cheque image and shop front verified.', action: 'APPROVED', createdAt: minsAgo(90) },
        { role: 3, comment: 'Tax registration and mobile contact confirmed.', action: 'APPROVED', createdAt: minsAgo(30) },
      ],
    },
    {
      title: 'Nadeem Qureshi — City Traders',
      cName: 'Nadeem Qureshi',
      bName: 'City Traders',
      shopPicture: shopImgA,
      channel: 'W.S',
      cnicNo: '37405-1122334-1',
      ntnNo: '1122334-5',
      mobileNo: '0302-1122334',
      address: 'Raja Bazaar, Rawalpindi',
      days: '15',
      creditLimit: 300000,
      chequeStatus: 'No',
      chequeNo: '',
      chequeAmount: null,
      chequePicture: '',
      creditType: 'Closure',
      currentStage: 2,
      status: 'REJECTED',
      isUpdated: false,
      comments: [
        { role: 2, comment: 'Outstanding balance must be cleared before closure.', action: 'REJECTED', createdAt: minsAgo(110) },
      ],
    },
    {
      title: 'Zeeshan Haider — National Pharmacy',
      cName: 'Zeeshan Haider',
      bName: 'National Pharmacy',
      shopPicture: shopImgB,
      channel: 'Retail',
      cnicNo: '42201-9900112-7',
      ntnNo: '9900112-8',
      mobileNo: '0334-9900112',
      address: 'Clifton Block 5, Karachi',
      days: '30',
      creditLimit: 700000,
      chequeStatus: 'Yes',
      chequeNo: 'CHQ-330099',
      chequeAmount: 500000,
      chequePicture: chequeImg,
      creditType: 'Increment',
      currentStage: 3,
      status: 'REJECTED',
      isUpdated: false,
      comments: [
        { role: 2, comment: 'Initial documents received.', action: 'APPROVED', createdAt: minsAgo(140) },
        { role: 3, comment: 'Cheque amount (500,000) is lower than requested credit limit (700,000).', action: 'REJECTED', createdAt: minsAgo(80) },
      ],
    },
  ];

  await Form.deleteMany({});
  await Form.insertMany(records);
  console.log(`[SEED] Inserted ${records.length} dummy forms into MongoDB.`);
  await disconnectDB();
}

runSeed().catch(async (err) => {
  console.error('[SEED] Failed:', err);
  await disconnectDB();
  process.exit(1);
});
