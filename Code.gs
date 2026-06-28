const SHEETS = {
  cases: '個案清單',
  registrationSummary: '捐款登記總表'
};

const LEGACY_SHEETS = {
  cases: 'Cases',
  registrations: 'Registrations',
  chineseRegistrations: '捐款登記'
};

const HEADERS = {
  cases: [
    '個案編號',
    '個案名稱',
    '目標金額',
    '目前登記金額',
    '是否開放',
    '狀態',
    '備註',
    '建立時間',
    '更新時間'
  ],
  registrations: [
    '登記編號',
    '個案編號',
    '代表人姓名',
    '代表人手機',
    '總金額',
    '付款方式',
    '捐款芳名清單',
    '是否需要收據',
    '收據狀態',
    '付款狀態',
    '入帳日期',
    '收據編號',
    '收據日期',
    '登記時間',
    '更新時間',
    'LINE使用者ID',
    'LINE顯示名稱',
    '備註'
  ]
};

const FIELD_ALIASES = {
  caseId: ['個案編號', 'caseId'],
  title: ['個案名稱', 'title'],
  targetAmount: ['目標金額', 'targetAmount'],
  currentAmount: ['目前登記金額', 'currentAmount'],
  opened: ['是否開放', 'opened'],
  status: ['狀態', 'status'],
  note: ['備註', 'note'],
  createdAt: ['建立時間', '登記時間', 'createdAt'],
  updatedAt: ['更新時間', 'updatedAt'],
  recordId: ['登記編號', 'recordId'],
  representativeName: ['代表人姓名', 'representativeName'],
  representativePhone: ['代表人手機', 'representativePhone'],
  totalAmount: ['總金額', 'totalAmount'],
  paymentMethod: ['付款方式', 'paymentMethod'],
  donorListJson: ['捐款芳名清單', 'donorListJson'],
  receiptRequired: ['是否需要收據', 'receiptRequired'],
  receiptStatus: ['收據狀態', 'receiptStatus'],
  paymentStatus: ['付款狀態', 'paymentStatus'],
  paymentDate: ['入帳日期', 'paymentDate'],
  receiptNo: ['收據編號', 'receiptNo'],
  receiptDate: ['收據日期', 'receiptDate'],
  lineUserId: ['LINE使用者ID', 'lineUserId'],
  liffProfileName: ['LINE顯示名稱', 'liffProfileName'],
  memo: ['備註', 'memo']
};

const PAYMENT_METHOD_LABELS = {
  bankTransfer: '銀行轉帳',
  atm: 'ATM',
  cash: '現金',
  other: '其他'
};

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialMode = e && e.parameter && e.parameter.admin ? 'admin' : 'front';
  template.liffId = PropertiesService.getScriptProperties().getProperty('LIFF_ID') || '';
  return template
    .evaluate()
    .setTitle('543 捐款回報')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const casesSheet = ensureSheet_(ss, SHEETS.cases, LEGACY_SHEETS.cases);
  const summarySheet = ensureSummarySheet_(ss);

  applyHeaders_(casesSheet, HEADERS.cases);
  if (casesSheet.getLastRow() === 1) {
    const now = new Date();
    casesSheet.getRange(2, 1, 3, HEADERS.cases.length).setValues([
      ['E105', '郵振畢先生', 60000, 8200, true, '開放中', '示範個案', now, now],
      ['E106', '李美玲女士', 50000, 12000, true, '開放中', '示範個案', now, now],
      ['E107', '王小華同學', 40000, 5000, true, '開放中', '示範個案', now, now]
    ]);
  }

  applyHeaders_(summarySheet, HEADERS.registrations);
  migrateExistingRows_(summarySheet);
  createCaseRegistrationSheets_(listCases(), readRowsFromSheet_(summarySheet));

  return { ok: true };
}

function getInitialData() {
  return {
    cases: listCases(),
    registrations: listRegistrations()
  };
}

function listCases() {
  const sheet = getSheet_(SHEETS.cases, LEGACY_SHEETS.cases);
  const rows = readRowsFromSheet_(sheet);
  return rows
    .filter((row) => isOpen_(row.opened) && !isCaseFull_(row))
    .map((row) => ({
      caseId: row.caseId,
      title: row.title,
      targetAmount: Number(row.targetAmount || 0),
      currentAmount: Number(row.currentAmount || 0),
      remainingAmount: Math.max(Number(row.targetAmount || 0) - Number(row.currentAmount || 0), 0),
      status: row.status || '開放中',
      note: row.note || ''
    }));
}

function listRegistrations() {
  return readAllCaseRegistrationRows_()
    .filter((row) => row.recordId)
    .map(normalizeRegistration_);
}

function createRegistration(payload) {
  validateRegistration_(payload);

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const now = new Date();
    const recordId = nextRecordId_(payload.caseId);
    const donors = (payload.donors || []).map((donor) => ({
      name: String(donor.name || '').trim(),
      amount: Number(donor.amount || 0)
    }));
    const row = [
      recordId,
      payload.caseId,
      String(payload.representativeName || '').trim(),
      String(payload.representativePhone || '').trim(),
      Number(payload.totalAmount || 0),
      normalizePaymentMethod_(payload.paymentMethod || 'bankTransfer'),
      formatDonorsForSheet_(donors),
      payload.receiptRequired ? '是' : '否',
      payload.receiptRequired ? '待處理' : '不需收據',
      '待付款',
      '',
      '',
      '',
      now,
      now,
      payload.lineUserId || '',
      payload.liffProfileName || '',
      payload.memo || ''
    ];

    const caseSheet = ensureCaseRegistrationSheet_(payload.caseId);
    const summarySheet = getSheet_(SHEETS.registrationSummary);
    caseSheet.appendRow(row);
    summarySheet.appendRow(row);
    updateCaseCurrentAmount_(payload.caseId);

    return { ok: true, record: normalizeRegistration_(rowToCanonicalObject_(HEADERS.registrations, row)) };
  } finally {
    lock.releaseLock();
  }
}

function updatePayment(recordId, paymentStatus, paymentDate) {
  return updateRegistration_(recordId, {
    paymentStatus: paymentStatus === 'paid' ? '已確認入帳' : paymentStatus,
    paymentDate: paymentDate || '',
    updatedAt: new Date()
  });
}

function reportPayment(recordId, reportMemo) {
  const memo = String(reportMemo || '').trim();
  return updateRegistration_(recordId, {
    paymentStatus: '已回報',
    memo: memo ? `付款回報：${memo}` : '付款回報',
    updatedAt: new Date()
  });
}

function cancelRegistration(recordId, cancelMemo) {
  const result = updateRegistration_(recordId, {
    paymentStatus: '已取消',
    receiptStatus: '不處理',
    memo: cancelMemo ? `取消登記：${cancelMemo}` : '取消登記',
    updatedAt: new Date()
  });
  updateCaseCurrentAmount_(result.record.caseId);
  return result;
}

function updateReceipt(recordId, receiptStatus, receiptNo, receiptDate) {
  return updateRegistration_(recordId, {
    receiptStatus: receiptStatus === 'done' ? '收據已處理' : receiptStatus,
    receiptNo: receiptNo || '',
    receiptDate: receiptDate || '',
    updatedAt: new Date()
  });
}

function resetPaymentStatus(recordId, paymentStatus, memo) {
  const statusMap = {
    pending: '待付款',
    reported: '已回報',
    paid: '已確認入帳',
    cancelled: '已取消'
  };
  const status = statusMap[paymentStatus] || paymentStatus;
  const patch = {
    paymentStatus: status,
    updatedAt: new Date()
  };

  if (status !== '已確認入帳') {
    patch.paymentDate = '';
  }
  if (status === '已取消') {
    patch.receiptStatus = '不處理';
  }
  if (memo) {
    patch.memo = `後台修正：${memo}`;
  }

  const result = updateRegistration_(recordId, patch);
  updateCaseCurrentAmount_(result.record.caseId);
  return result;
}

function resetReceiptStatus(recordId, receiptStatus, memo) {
  const statusMap = {
    pending: '待處理',
    notRequired: '不需收據',
    done: '收據已處理',
    ignored: '不處理'
  };
  const status = statusMap[receiptStatus] || receiptStatus;
  const patch = {
    receiptStatus: status,
    updatedAt: new Date()
  };

  if (status !== '收據已處理') {
    patch.receiptNo = '';
    patch.receiptDate = '';
  }
  if (memo) {
    patch.memo = `後台修正：${memo}`;
  }

  return updateRegistration_(recordId, patch);
}

function ensureSheet_(ss, sheetName, legacyName) {
  const sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  const legacySheet = legacyName ? ss.getSheetByName(legacyName) : null;
  if (legacySheet) {
    legacySheet.setName(sheetName);
    return legacySheet;
  }

  return ss.insertSheet(sheetName);
}

function ensureSummarySheet_(ss) {
  const summary = ss.getSheetByName(SHEETS.registrationSummary);
  if (summary) return summary;

  const oldChinese = ss.getSheetByName(LEGACY_SHEETS.chineseRegistrations);
  if (oldChinese) {
    oldChinese.setName(SHEETS.registrationSummary);
    return oldChinese;
  }

  const legacy = ss.getSheetByName(LEGACY_SHEETS.registrations);
  if (legacy) {
    legacy.setName(SHEETS.registrationSummary);
    return legacy;
  }

  return ss.insertSheet(SHEETS.registrationSummary);
}

function applyHeaders_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function createCaseRegistrationSheets_(cases, summaryRows) {
  cases.forEach((caseItem) => {
    const sheet = ensureCaseRegistrationSheet_(caseItem.caseId);
    if (sheet.getLastRow() > 1) {
      migrateExistingRows_(sheet);
      return;
    }

    const rows = summaryRows
      .filter((row) => row.caseId === caseItem.caseId)
      .map(canonicalRegistrationToRow_);

    if (rows.length) {
      sheet.getRange(2, 1, rows.length, HEADERS.registrations.length).setValues(rows);
      sheet.autoResizeColumns(1, HEADERS.registrations.length);
    }
  });
}

function ensureCaseRegistrationSheet_(caseId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getCaseRegistrationSheetName_(caseId);
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  applyHeaders_(sheet, HEADERS.registrations);
  return sheet;
}

function getCaseRegistrationSheetName_(caseId) {
  const safeCaseId = String(caseId || '未分類').replace(/[\\/?*[\]:]/g, '-').slice(0, 30);
  return `${safeCaseId}_捐款登記`;
}

function isCaseRegistrationSheet_(sheetName) {
  return /_捐款登記$/.test(sheetName);
}

function migrateExistingRows_(sheet) {
  if (sheet.getLastRow() < 2) return;

  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.registrations.length);
  const rows = range.getValues();
  const migrated = rows.map((row) => canonicalRegistrationToRow_(rowToCanonicalObject_(HEADERS.registrations, row)));
  range.setValues(migrated);
  sheet.autoResizeColumns(1, HEADERS.registrations.length);
}

function canonicalRegistrationToRow_(canonical) {
  const donors = parseDonors_(canonical.donorListJson);
  return [
    canonical.recordId,
    canonical.caseId,
    canonical.representativeName,
    canonical.representativePhone,
    canonical.totalAmount,
    normalizePaymentMethod_(canonical.paymentMethod),
    formatDonorsForSheet_(donors),
    isYes_(canonical.receiptRequired) ? '是' : '否',
    normalizeReceiptStatus_(canonical.receiptStatus),
    normalizePaymentStatus_(canonical.paymentStatus),
    canonical.paymentDate,
    canonical.receiptNo,
    canonical.receiptDate,
    canonical.createdAt,
    canonical.updatedAt,
    canonical.lineUserId,
    canonical.liffProfileName,
    canonical.memo
  ];
}

function getSheet_(sheetName, legacyName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName) || (legacyName ? ss.getSheetByName(legacyName) : null);
  if (!sheet) throw new Error(`找不到資料表：${sheetName}`);
  return sheet;
}

function readRowsFromSheet_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values.shift();
  return values.map((row) => rowToCanonicalObject_(headers, row));
}

function readAllCaseRegistrationRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const caseSheets = ss.getSheets().filter((sheet) => isCaseRegistrationSheet_(sheet.getName()));

  if (caseSheets.length) {
    return caseSheets.flatMap((sheet) => readRowsFromSheet_(sheet));
  }

  const summarySheet = getSheet_(SHEETS.registrationSummary, LEGACY_SHEETS.registrations);
  return readRowsFromSheet_(summarySheet);
}

function rowToCanonicalObject_(headers, row) {
  const raw = headers.reduce((obj, header, index) => {
    obj[header] = row[index];
    return obj;
  }, {});

  return Object.keys(FIELD_ALIASES).reduce((obj, key) => {
    const alias = FIELD_ALIASES[key].find((name) => Object.prototype.hasOwnProperty.call(raw, name));
    obj[key] = alias ? raw[alias] : '';
    return obj;
  }, {});
}

function normalizeRegistration_(row) {
  let donors = [];
  try {
    donors = row.donorListJson ? parseDonors_(row.donorListJson) : [];
  } catch (error) {
    donors = [];
  }

  donors = donors.map((donor) => ({
    name: donor.name || donor['姓名'] || '',
    amount: Number(donor.amount || donor['金額'] || 0)
  }));

  return {
    recordId: row.recordId,
    caseId: row.caseId,
    representativeName: row.representativeName,
    representativePhone: row.representativePhone,
    totalAmount: Number(row.totalAmount || 0),
    paymentMethod: normalizePaymentMethod_(row.paymentMethod),
    donors,
    receiptRequired: isYes_(row.receiptRequired),
    receiptStatus: normalizeReceiptStatus_(row.receiptStatus),
    paymentStatus: normalizePaymentStatus_(row.paymentStatus),
    paymentDate: formatDate_(row.paymentDate),
    receiptNo: row.receiptNo || '',
    receiptDate: formatDate_(row.receiptDate),
    createdAt: formatDateTime_(row.createdAt),
    updatedAt: formatDateTime_(row.updatedAt),
    lineUserId: row.lineUserId || '',
    liffProfileName: row.liffProfileName || '',
    memo: row.memo || ''
  };
}

function formatDonorsForSheet_(donors) {
  return donors
    .map((donor) => `${donor.name}：${donor.amount}`)
    .join('；');
}

function parseDonors_(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  if (text.charAt(0) === '[') {
    return JSON.parse(text);
  }

  return text.split(/[；;]/).map((item) => {
    const parts = item.split(/[：:]/);
    return {
      name: String(parts[0] || '').trim(),
      amount: Number(String(parts[1] || '0').replace(/,/g, '').trim())
    };
  }).filter((donor) => donor.name && donor.amount > 0);
}

function nextRecordId_(caseId) {
  const rows = readRowsFromSheet_(ensureCaseRegistrationSheet_(caseId));
  const count = rows.filter((row) => row.caseId === caseId).length + 1;
  return `${caseId}-${Utilities.formatString('%03d', count)}`;
}

function updateRegistration_(recordId, patch) {
  const sheets = getRegistrationUpdateSheets_(recordId);
  if (!sheets.length) {
    throw new Error(`找不到登記編號：${recordId}`);
  }

  let updatedRecord = null;
  sheets.forEach((sheet) => {
    const result = updateRegistrationInSheet_(sheet, recordId, patch);
    if (result) updatedRecord = result;
  });

  if (!updatedRecord) {
    throw new Error(`找不到登記編號：${recordId}`);
  }

  return { ok: true, record: normalizeRegistration_(updatedRecord) };
}

function getRegistrationUpdateSheets_(recordId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const caseId = String(recordId || '').split('-').slice(0, -1).join('-');
  const preferred = caseId ? ss.getSheetByName(getCaseRegistrationSheetName_(caseId)) : null;
  const sheets = [];

  if (preferred) sheets.push(preferred);
  const summary = ss.getSheetByName(SHEETS.registrationSummary);
  if (summary) sheets.push(summary);

  if (!preferred) {
    ss.getSheets()
      .filter((sheet) => isCaseRegistrationSheet_(sheet.getName()))
      .forEach((sheet) => sheets.push(sheet));
  }

  return sheets;
}

function updateRegistrationInSheet_(sheet, recordId, patch) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = findHeaderIndex_(headers, FIELD_ALIASES.recordId);
  const targetIndex = data.findIndex((row, index) => index > 0 && row[idIndex] === recordId);

  if (targetIndex === -1) return null;

  Object.keys(patch).forEach((key) => {
    const columnIndex = findHeaderIndex_(headers, FIELD_ALIASES[key] || [key]);
    if (columnIndex !== -1) {
      sheet.getRange(targetIndex + 1, columnIndex + 1).setValue(patch[key]);
    }
  });

  const updatedRow = sheet.getRange(targetIndex + 1, 1, 1, headers.length).getValues()[0];
  return rowToCanonicalObject_(headers, updatedRow);
}

function updateCaseCurrentAmount_(caseId) {
  const casesSheet = getSheet_(SHEETS.cases, LEGACY_SHEETS.cases);
  const registrations = readRowsFromSheet_(ensureCaseRegistrationSheet_(caseId));
  const total = registrations
    .filter((row) => row.caseId === caseId)
    .filter((row) => normalizePaymentStatus_(row.paymentStatus) !== '已取消')
    .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);

  const data = casesSheet.getDataRange().getValues();
  const headers = data[0];
  const caseIdIndex = findHeaderIndex_(headers, FIELD_ALIASES.caseId);
  const currentIndex = findHeaderIndex_(headers, FIELD_ALIASES.currentAmount);
  const updatedAtIndex = findHeaderIndex_(headers, FIELD_ALIASES.updatedAt);
  const targetIndex = data.findIndex((row, index) => index > 0 && row[caseIdIndex] === caseId);

  if (targetIndex !== -1) {
    casesSheet.getRange(targetIndex + 1, currentIndex + 1).setValue(total);
    casesSheet.getRange(targetIndex + 1, updatedAtIndex + 1).setValue(new Date());

    const targetAmount = Number(data[targetIndex][findHeaderIndex_(headers, FIELD_ALIASES.targetAmount)] || 0);
    const openedIndex = findHeaderIndex_(headers, FIELD_ALIASES.opened);
    const statusIndex = findHeaderIndex_(headers, FIELD_ALIASES.status);
    if (targetAmount > 0 && total >= targetAmount) {
      casesSheet.getRange(targetIndex + 1, openedIndex + 1).setValue('否');
      casesSheet.getRange(targetIndex + 1, statusIndex + 1).setValue('已額滿');
    }
  }
}

function findHeaderIndex_(headers, aliases) {
  return headers.findIndex((header) => aliases.indexOf(header) !== -1);
}

function validateRegistration_(payload) {
  if (!payload) throw new Error('缺少登記資料');
  if (!payload.caseId) throw new Error('請選擇開放個案');
  if (!payload.representativeName) throw new Error('請填寫代表人姓名');
  if (!payload.totalAmount || Number(payload.totalAmount) <= 0) throw new Error('總金額需大於 0');
  if (!payload.donors || !payload.donors.length) throw new Error('請至少填寫一位捐款人');
}

function isOpen_(value) {
  const text = String(value).trim().toLowerCase();
  return value === true || text === 'true' || text === '是' || text === '開放' || text === '開放中';
}

function isCaseFull_(row) {
  const targetAmount = Number(row.targetAmount || 0);
  const currentAmount = Number(row.currentAmount || 0);
  return targetAmount > 0 && currentAmount >= targetAmount;
}

function isYes_(value) {
  const text = String(value).trim().toLowerCase();
  return value === true || text === 'true' || text === '是' || text === '需要';
}

function normalizePaymentStatus_(value) {
  const text = String(value || '').trim();
  if (text === 'paid' || text === '已入帳') return '已確認入帳';
  if (text === 'pending' || text === '') return '待付款';
  if (text === 'reported') return '已回報';
  if (text === 'cancelled' || text === 'canceled') return '已取消';
  return text;
}

function normalizeReceiptStatus_(value) {
  const text = String(value || '').trim();
  if (text === 'done') return '收據已處理';
  if (text === 'notRequired') return '不需收據';
  if (text === 'pending' || text === '') return '待處理';
  return text;
}

function normalizePaymentMethod_(value) {
  const text = String(value || '').trim();
  return PAYMENT_METHOD_LABELS[text] || text || '銀行轉帳';
}

function formatDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}

function formatDateTime_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  }
  return String(value);
}
