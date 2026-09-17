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
    '更新時間',
    '是否歷史專案'
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
    '資料來源',
    '回報者LINE使用者ID',
    '回報者LINE顯示名稱',
    '付款帳號末五碼',
    '付款批號',
    '本次付款總額',
    '收據開立方式',
    'Email',
    '備註',
    '建立者LINE使用者ID',
    '建立者LINE顯示名稱'
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
  archived: ['是否歷史專案', 'archived'],
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
  sourceType: ['資料來源', 'sourceType'],
  reportedLineUserId: ['回報者LINE使用者ID', 'reportedLineUserId'],
  reportedProfileName: ['回報者LINE顯示名稱', 'reportedProfileName'],
  paymentLast5: ['付款帳號末五碼', 'paymentLast5'],
  paymentBatchId: ['付款批號', 'paymentBatchId'],
  paymentBatchTotal: ['本次付款總額', 'paymentBatchTotal'],
  receiptMode: ['收據開立方式', 'receiptMode'],
  receiptEmail: ['Email', 'receiptEmail'],
  createdByLineUserId: ['建立者LINE使用者ID', 'createdByLineUserId'],
  createdByProfileName: ['建立者LINE顯示名稱', 'createdByProfileName'],
  memo: ['備註', 'memo']
};

const PAYMENT_METHOD_LABELS = {
  bankTransfer: '轉帳',
  atm: '轉帳',
  cash: '現金',
  other: '其他'
};

const REGISTRATION_QUEUE_WAIT_MS = 45000;
const DUPLICATE_CHECK_VERSION = 2;
const ADMIN_PASSWORD_HASH_PROPERTY = 'ADMIN_PASSWORD_HASH';
const ADMIN_SESSION_TTL_SECONDS = 6 * 60 * 60;
const ADMIN_SESSION_CACHE_PREFIX = 'admin_session_';
const REGISTRATION_REQUIRED_FIELDS = [
  'recordId',
  'caseId',
  'representativeName',
  'representativePhone',
  'totalAmount',
  'paymentMethod',
  'donorListJson',
  'receiptRequired',
  'receiptStatus',
  'paymentStatus',
  'paymentDate',
  'receiptNo',
  'receiptDate',
  'createdAt',
  'updatedAt',
  'lineUserId',
  'liffProfileName',
  'sourceType',
  'reportedLineUserId',
  'reportedProfileName',
  'paymentLast5',
  'paymentBatchId',
  'paymentBatchTotal',
  'receiptMode',
  'receiptEmail',
  'memo',
  'createdByLineUserId',
  'createdByProfileName'
];

function logPerformance_(operation, phase, startedAt, details) {
  const entry = Object.assign({
    operation,
    phase,
    elapsedMs: Math.max(Date.now() - startedAt, 0)
  }, details || {});
  console.log(`[PERF] ${JSON.stringify(entry)}`);
}

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialMode = e && e.parameter && e.parameter.admin ? 'admin' : 'front';
  template.liffId = PropertiesService.getScriptProperties().getProperty('LIFF_ID') || '';
  template.initialLineUserId = e && e.parameter && e.parameter.lineUserId ? String(e.parameter.lineUserId) : '';
  template.initialLiffProfileName = e && e.parameter && e.parameter.liffProfileName ? String(e.parameter.liffProfileName) : '';
  return template
    .evaluate()
    .setTitle('543 捐款回報')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function configureAdminPassword_(password) {
  const cleanPassword = String(password || '').trim();
  if (cleanPassword.length < 12) {
    throw new Error('Admin password must be at least 12 characters.');
  }
  PropertiesService.getScriptProperties().setProperty(ADMIN_PASSWORD_HASH_PROPERTY, sha256Hex_(cleanPassword));
  return { ok: true };
}

function verifyAdminPassword(password, lineUserId) {
  const expectedHash = PropertiesService.getScriptProperties().getProperty(ADMIN_PASSWORD_HASH_PROPERTY);
  if (!expectedHash) {
    throw new Error('ADMIN_PASSWORD_HASH is not configured.');
  }

  const passwordHash = sha256Hex_(String(password || ''));
  if (!constantTimeEquals_(passwordHash, expectedHash)) {
    throw new Error('Invalid admin password.');
  }

  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(
    getAdminSessionCacheKey_(token),
    JSON.stringify({
      lineUserId: String(lineUserId || ''),
      createdAt: new Date().toISOString()
    }),
    ADMIN_SESSION_TTL_SECONDS
  );
  return { ok: true, token, expiresIn: ADMIN_SESSION_TTL_SECONDS };
}

function requireAdmin_(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    throw new Error('Admin authorization required.');
  }
  const session = CacheService.getScriptCache().get(getAdminSessionCacheKey_(cleanToken));
  if (!session) {
    throw new Error('Admin session expired. Please sign in again.');
  }
  return JSON.parse(session);
}

function getAdminSessionCacheKey_(token) {
  return ADMIN_SESSION_CACHE_PREFIX + sha256Hex_(String(token || ''));
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map((byte) => {
      const unsigned = byte < 0 ? byte + 256 : byte;
      return ('0' + unsigned.toString(16)).slice(-2);
    })
    .join('');
}

function constantTimeEquals_(left, right) {
  left = String(left || '');
  right = String(right || '');
  let diff = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
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
      ['E105', '郵振畢先生', 60000, 8200, true, '開放中', '示範個案', now, now, '否'],
      ['E106', '李美玲女士', 50000, 12000, true, '開放中', '示範個案', now, now, '否'],
      ['E107', '王小華同學', 40000, 5000, true, '開放中', '示範個案', now, now, '否']
    ]);
  }

  migrateExistingRows_(summarySheet);
  createCaseRegistrationSheets_(listCases(), readRowsFromSheet_(summarySheet));

  return { ok: true };
}

function getInitialData(options) {
  options = options || {};
  const lineUserId = String(options.lineUserId || '').trim();
  const isAdmin = options.admin === true;
  if (isAdmin) requireAdmin_(options.adminToken);
  const registrations = isAdmin
    ? listRegistrations()
    : listRegistrations().filter((record) => lineUserId && record.lineUserId === lineUserId);

  return {
    cases: listCases(),
    reportCases: listAllCases_(),
    registrations
  };
}

function getFrontInitialData(options) {
  options = options || {};
  const lineUserId = String(options.lineUserId || '').trim();
  const casesData = getFrontCases();
  const registrations = lineUserId ? listRegistrationsForLineUser_(lineUserId) : [];

  return {
    cases: casesData.cases,
    reportCases: casesData.reportCases,
    registrations
  };
}

function getFrontCases() {
  const allCases = listAllCases_();
  const cases = allCases
    .filter(isFrontVisibleCase_);

  return {
    cases,
    reportCases: cases
  };
}

function getAdminCasesData(options) {
  options = options || {};
  requireAdmin_(options.adminToken);
  return {
    cases: listCases(),
    reportCases: listAllCases_()
  };
}

function getAdminRegistrationsData(options) {
  options = options || {};
  requireAdmin_(options.adminToken);
  return {
    registrations: listRegistrations()
  };
}

function getMyRegistrationData(options) {
  const totalStartedAt = Date.now();
  let succeeded = false;
  options = options || {};
  const lineUserId = String(options.lineUserId || '').trim();
  try {
    const readStartedAt = Date.now();
    const rows = lineUserId
      ? readRegistrationRowsFromSheet_(getSheet_(SHEETS.registrationSummary, LEGACY_SHEETS.registrations))
      : [];
    logPerformance_('getMyRegistrationData', 'sheet_read', readStartedAt, {
      success: true,
      rowCount: rows.length
    });
    const normalizeStartedAt = Date.now();
    const registrations = rows
      .filter((row) => row.recordId)
      .map(normalizeRegistration_)
      .filter((record) => record.lineUserId === lineUserId);
    logPerformance_('getMyRegistrationData', 'normalize_filter', normalizeStartedAt, {
      success: true,
      rowCount: registrations.length
    });
    succeeded = true;
    return { registrations };
  } finally {
    logPerformance_('getMyRegistrationData', 'total', totalStartedAt, { success: succeeded });
  }
}

function listCases() {
  return listAllCases_()
    .filter((row) => isOpen_(row.opened) && !isCaseFull_(row) && !isCaseClosed_(row));
}

function listRegistrationsForLineUser_(lineUserId) {
  const targetLineUserId = String(lineUserId || '').trim();
  if (!targetLineUserId) return [];

  const summarySheet = getSheet_(SHEETS.registrationSummary, LEGACY_SHEETS.registrations);
  return readRegistrationRowsFromSheet_(summarySheet)
    .filter((row) => row.recordId)
    .map(normalizeRegistration_)
    .filter((record) => record.lineUserId === targetLineUserId);
}

function listAllCases_() {
  const sheet = getSheet_(SHEETS.cases, LEGACY_SHEETS.cases);
  const rows = readRowsFromSheet_(sheet);
  return rows
    .map((row) => {
      const targetAmount = Number(row.targetAmount || 0);
      const currentAmount = Number(row.currentAmount || 0);
      return {
        caseId: row.caseId,
        title: row.title,
        targetAmount,
        currentAmount,
        remainingAmount: Math.max(targetAmount - currentAmount, 0),
      opened: row.opened,
      archived: isYes_(row.archived),
      status: row.status || '開放中',
      note: row.note || ''
      };
    });
}

function setCaseArchived(caseId, archived) {
  requireAdmin_(arguments[2]);
  const sheet = getSheet_(SHEETS.cases, LEGACY_SHEETS.cases);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const caseIdIndex = findHeaderIndex_(headers, FIELD_ALIASES.caseId);
  const archivedIndex = findHeaderIndex_(headers, FIELD_ALIASES.archived);
  const updatedAtIndex = findHeaderIndex_(headers, FIELD_ALIASES.updatedAt);
  const openedIndex = findHeaderIndex_(headers, FIELD_ALIASES.opened);
  const statusIndex = findHeaderIndex_(headers, FIELD_ALIASES.status);
  if ([caseIdIndex, archivedIndex, updatedAtIndex, openedIndex, statusIndex].some((index) => index === -1)) {
    throw new Error('個案清單欄位不相容，請先執行管理者維護。');
  }
  const targetIndex = data.findIndex((row, index) => index > 0 && row[caseIdIndex] === caseId);
  if (targetIndex === -1) throw new Error(`找不到個案：${caseId}`);

  sheet.getRange(targetIndex + 1, archivedIndex + 1).setValue(archived ? '是' : '否');
  if (updatedAtIndex !== -1) {
    sheet.getRange(targetIndex + 1, updatedAtIndex + 1).setValue(new Date());
  }
  if (openedIndex !== -1) {
    sheet.getRange(targetIndex + 1, openedIndex + 1).setValue('否');
  }
  if (statusIndex !== -1) {
    sheet.getRange(targetIndex + 1, statusIndex + 1).setValue(archived ? '已結案' : '未開放');
  }
  return { ok: true, caseId, archived: Boolean(archived) };
}

function listRegistrations() {
  return readAllCaseRegistrationRows_()
    .filter((row) => row.recordId)
    .map(normalizeRegistration_);
}

function checkDuplicateRegistration(payload) {
  const totalStartedAt = Date.now();
  let succeeded = false;
  payload = payload || {};
  const targetCaseId = String(payload.caseId || '').trim();
  const donors = (payload.donors || [])
    .map((donor) => ({
      name: normalizeDuplicateName_(donor.name),
      amount: Number(donor.amount || 0)
    }))
    .filter((donor) => donor.name && donor.amount > 0);
  if (!targetCaseId || !donors.length) {
    logPerformance_('checkDuplicateRegistration', 'total', totalStartedAt, {
      success: true,
      rowCount: 0
    });
    return { duplicates: [] };
  }

  try {
    const readStartedAt = Date.now();
    const records = listRegistrationsForCase_(targetCaseId);
    logPerformance_('checkDuplicateRegistration', 'sheet_read', readStartedAt, {
      success: true,
      rowCount: records.length
    });
    const scanStartedAt = Date.now();
    const duplicates = findDuplicateRegistrations_(records, donors);
    logPerformance_('checkDuplicateRegistration', 'duplicate_scan', scanStartedAt, {
      success: true,
      rowCount: records.length
    });
    succeeded = true;
    return { duplicates };
  } finally {
    logPerformance_('checkDuplicateRegistration', 'total', totalStartedAt, { success: succeeded });
  }
}

function searchRegistrationsForReport(caseId, keyword) {
  const targetCaseId = String(caseId || '').trim();
  const searchText = String(keyword || '').trim().toLowerCase();
  if (!targetCaseId) throw new Error('請先選擇專案');
  if (!searchText) throw new Error('請輸入芳名搜尋');
  const caseInfo = listAllCases_().find((item) => item.caseId === targetCaseId);
  if (!caseInfo || isCaseClosed_(caseInfo)) throw new Error('此專案已結案，若需處理請先請管理者恢復為目前專案。');

  return listRegistrationsForCase_(targetCaseId)
    .filter((record) => !record.lineUserId || record.sourceType === 'helper_created' || record.sourceType === '小幫手代填')
    .filter((record) => isPaymentPending_(record.paymentStatus))
    .filter((record) => {
      const donorText = record.donors.map((donor) => donor.name).join(' ');
      return [record.representativeName, donorText]
        .some((value) => String(value || '').toLowerCase().indexOf(searchText) !== -1);
    })
    .slice(0, 20);
}

function listRegistrationsForCase_(caseId) {
  const targetCaseId = String(caseId || '').trim();
  if (!targetCaseId) return [];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const caseSheet = ss.getSheetByName(getCaseRegistrationSheetName_(targetCaseId));
  const sourceSheet = caseSheet || getSheet_(SHEETS.registrationSummary, LEGACY_SHEETS.registrations);
  const rows = readRegistrationRowsFromSheet_(sourceSheet)
    .filter((row) => row.caseId === targetCaseId);

  return rows
    .filter((row) => row.recordId)
    .map(normalizeRegistration_);
}

function findDuplicateRegistrations_(records, donors) {
  const targets = (donors || []).reduce((map, donor) => {
    const name = normalizeDuplicateName_(donor.name);
    if (name) map[name] = true;
    return map;
  }, {});

  return (records || [])
    .filter((record) => normalizePaymentStatus_(record.paymentStatus) !== '已取消')
    .flatMap((record) => record.donors
      .map((donor) => ({
        recordId: record.recordId,
        representativeName: record.representativeName,
        name: String(donor.name || '').trim(),
        amount: Number(donor.amount || 0)
      }))
      .filter((donor) => targets[normalizeDuplicateName_(donor.name)]))
    .slice(0, 10);
}

function createRegistration(payload) {
  const totalStartedAt = Date.now();
  validateRegistration_(payload);
  const donors = (payload.donors || []).map((donor) => ({
    name: String(donor.name || '').trim(),
    amount: Number(donor.amount || 0)
  }));
  const normalized = {
    caseId: String(payload.caseId || '').trim(),
    representativeName: String(payload.representativeName || '').trim(),
    representativePhone: String(payload.representativePhone || '').trim(),
    totalAmount: Number(payload.totalAmount || 0),
    paymentMethod: payload.paymentMethod || 'bankTransfer',
    donorListJson: formatDonorsForSheet_(donors),
    lineUserId: payload.lineUserId || '',
    liffProfileName: payload.liffProfileName || '',
    sourceType: payload.sourceType || 'self_created',
    memo: payload.memo || ''
  };
  const duplicateCheckVersion = Number(payload.duplicateCheckVersion || 0);
  const duplicateConfirmed = payload.duplicateConfirmed === true;

  const lock = LockService.getScriptLock();
  let locked = false;
  let lockAcquiredAt = 0;
  let succeeded = false;

  try {
    const lockWaitStartedAt = Date.now();
    try {
      lock.waitLock(REGISTRATION_QUEUE_WAIT_MS);
      logPerformance_('createRegistration', 'lock_wait', lockWaitStartedAt, { success: true });
    } catch (error) {
      logPerformance_('createRegistration', 'lock_wait', lockWaitStartedAt, { success: false });
      throw error;
    }
    locked = true;
    lockAcquiredAt = Date.now();

    const sheetStartedAt = Date.now();
    const caseSheet = ensureCaseRegistrationSheet_(normalized.caseId);
    const summarySheet = getOrCreateRegistrationSummarySheet_();
    const caseRows = readRegistrationRowsFromSheet_(caseSheet);
    logPerformance_('createRegistration', 'sheet_read', sheetStartedAt, {
      success: true,
      rowCount: caseRows.length
    });

    const currentAmount = calculateCurrentAmountFromRows_(caseRows, normalized.caseId);
    const capacityStartedAt = Date.now();
    validateCaseStillOpenForRegistration_(normalized.caseId, normalized.totalAmount, currentAmount);
    logPerformance_('createRegistration', 'capacity_check', capacityStartedAt, { success: true });

    const duplicateStartedAt = Date.now();
    const normalizedRecords = caseRows
      .filter((row) => row.recordId)
      .map(normalizeRegistration_);
    const duplicates = findDuplicateRegistrations_(normalizedRecords, donors);
    logPerformance_('createRegistration', 'duplicate_recheck', duplicateStartedAt, {
      success: true,
      rowCount: normalizedRecords.length
    });
    if (duplicates.length
      && duplicateCheckVersion >= DUPLICATE_CHECK_VERSION
      && !duplicateConfirmed) {
      throw new Error('送出前發現新的重複芳名紀錄，請重新確認後再送出。');
    }

    const recordIdStartedAt = Date.now();
    const recordId = nextRecordId_(normalized.caseId, caseRows);
    logPerformance_('createRegistration', 'record_id', recordIdStartedAt, { success: true });

    const now = new Date();
    const row = canonicalRegistrationToRow_(Object.assign({}, normalized, {
      recordId,
      receiptRequired: '否',
      receiptStatus: '待回報',
      paymentStatus: '待付款',
      paymentDate: '',
      receiptNo: '',
      receiptDate: '',
      createdAt: now,
      updatedAt: now,
      lineUserId: payload.lineUserId || '',
      liffProfileName: payload.liffProfileName || '',
      sourceType: payload.sourceType || 'self_created',
      reportedLineUserId: '',
      reportedProfileName: '',
      paymentLast5: '',
      paymentBatchId: '',
      paymentBatchTotal: '',
      receiptMode: '',
      receiptEmail: '',
      createdByLineUserId: normalized.lineUserId,
      createdByProfileName: normalized.liffProfileName
    }));

    const appendCaseStartedAt = Date.now();
    caseSheet.appendRow(row);
    logPerformance_('createRegistration', 'append_case', appendCaseStartedAt, { success: true });
    const appendSummaryStartedAt = Date.now();
    summarySheet.appendRow(row);
    logPerformance_('createRegistration', 'append_summary', appendSummaryStartedAt, { success: true });
    const caseUpdateStartedAt = Date.now();
    updateCaseCurrentAmount_(normalized.caseId, currentAmount + normalized.totalAmount);
    logPerformance_('createRegistration', 'case_status_update', caseUpdateStartedAt, { success: true });

    succeeded = true;
    return { ok: true, record: normalizeRegistration_(rowToCanonicalObject_(HEADERS.registrations, row)) };
  } catch (error) {
    if (/Lock|鎖定/.test(String(error && error.message || error))) {
      throw new Error('目前登記人數較多，系統正在排隊處理。請稍後再送出一次。');
    }
    throw error;
  } finally {
    if (locked) {
      lock.releaseLock();
      logPerformance_('createRegistration', 'lock_held', lockAcquiredAt, { success: succeeded });
    }
    logPerformance_('createRegistration', 'total', totalStartedAt, { success: succeeded });
  }
}

function createHelperRegistrations(payload) {
  payload = payload || {};
  requireAdmin_(payload.adminToken);
  if (!payload.caseId) throw new Error('請選擇專案');
  if (!payload.lineUserId) throw new Error('尚未取得小幫手 LINE 身分');
  const donors = (payload.donors || []).map((donor) => ({
    name: String(donor.name || '').trim(),
    amount: Number(donor.amount || 0)
  })).filter((donor) => donor.name && donor.amount > 0);
  if (!donors.length) throw new Error('請輸入至少一位芳名與金額');
  const representativeName = String(payload.representativeName || '').trim();
  if (!representativeName) throw new Error('請輸入代表人姓名');

  const totalAmount = donors.reduce((sum, donor) => sum + donor.amount, 0);
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(REGISTRATION_QUEUE_WAIT_MS);
    locked = true;
    const caseSheet = ensureCaseRegistrationSheet_(payload.caseId);
    const summarySheet = getOrCreateRegistrationSummarySheet_();
    const caseRows = readRegistrationRowsFromSheet_(caseSheet);
    const currentAmount = calculateCurrentAmountFromRows_(caseRows, payload.caseId);
    validateCaseStillOpenForRegistration_(payload.caseId, totalAmount, currentAmount);

    const now = new Date();
    const recordId = nextRecordId_(payload.caseId, caseRows);
    const row = canonicalRegistrationToRow_({
      recordId,
      caseId: payload.caseId,
      representativeName,
      representativePhone: '',
      totalAmount,
      paymentMethod: payload.paymentMethod || 'bankTransfer',
      donorListJson: formatDonorsForSheet_(donors),
      receiptRequired: '否',
      receiptStatus: '待回報',
      paymentStatus: '待付款',
      paymentDate: '',
      receiptNo: '',
      receiptDate: '',
      createdAt: now,
      updatedAt: now,
      lineUserId: '',
      liffProfileName: '',
      sourceType: 'helper_created',
      reportedLineUserId: '',
      reportedProfileName: '',
      paymentLast5: '',
      paymentBatchId: '',
      paymentBatchTotal: '',
      receiptMode: '',
      receiptEmail: '',
      memo: payload.memo || '',
      createdByLineUserId: payload.lineUserId || '',
      createdByProfileName: payload.liffProfileName || ''
    });
    caseSheet.appendRow(row);
    summarySheet.appendRow(row);
    const records = [normalizeRegistration_(rowToCanonicalObject_(HEADERS.registrations, row))];

    updateCaseCurrentAmount_(payload.caseId, currentAmount + totalAmount);
    const caseInfo = listAllCases_().find((item) => item.caseId === payload.caseId) || {};
    return {
      ok: true,
      records,
      totalAmount,
      remainingAmount: Number(caseInfo.remainingAmount || 0)
    };
  } catch (error) {
    if (String(error && error.message || error).indexOf('Lock') !== -1) {
      throw new Error('目前登記人數較多，系統正在排隊處理。請稍後再送出一次。');
    }
    throw error;
  } finally {
    if (locked) lock.releaseLock();
  }
}

function updatePayment(recordId, paymentStatus, paymentDate) {
  requireAdmin_(arguments[3]);
  return updateRegistration_(recordId, {
    paymentStatus: paymentStatus === 'paid' ? '已確認入帳' : paymentStatus,
    paymentDate: paymentDate || '',
    updatedAt: new Date()
  });
}

function reportPayment(recordId, reportMemo) {
  return reportRegistrationBatch({
    recordIds: [recordId],
    paymentLast5: reportMemo,
    receiptRequired: false,
    memo: ''
  });
}

function reportRegistrationDetails(recordId, payload) {
  payload = payload || {};
  return reportRegistrationBatch(Object.assign({}, payload, {
    recordIds: [recordId]
  }));
}

function reportRegistrationBatch(payload) {
  const totalStartedAt = Date.now();
  payload = payload || {};
  const recordIds = Array.isArray(payload.recordIds)
    ? Array.from(new Set(payload.recordIds.map((id) => String(id || '').trim()).filter(Boolean)))
    : [];
  if (!recordIds.length) throw new Error('請至少選擇一筆待回報紀錄。');

  const paymentLast5 = String(payload.paymentLast5 || '').trim();
  if (!/^\d{5}$/.test(paymentLast5)) {
    throw new Error('付款回報請只輸入帳號末 5 碼，必須剛好是 5 個數字。現金請輸入 00000。');
  }

  const receiptRequired = payload.receiptRequired === true || String(payload.receiptRequired) === 'true';
  const receiptMode = receiptRequired ? String(payload.receiptMode || 'representativeTotal') : '';
  const receiptEmail = receiptRequired ? String(payload.receiptEmail || '').trim() : '';
  if (receiptRequired && !receiptEmail) {
    throw new Error('需要收據時請填寫 Email 地址。');
  }

  const lineUserId = String(payload.lineUserId || '').trim();
  const liffProfileName = String(payload.liffProfileName || '').trim();
  if (!lineUserId) throw new Error('尚未取得 LINE 身分，請從 LINE 重新開啟。');

  const lock = LockService.getScriptLock();
  let locked = false;
  let lockAcquiredAt = 0;
  let succeeded = false;
  try {
    const lockWaitStartedAt = Date.now();
    try {
      lock.waitLock(REGISTRATION_QUEUE_WAIT_MS);
      logPerformance_('reportRegistrationBatch', 'lock_wait', lockWaitStartedAt, { success: true });
    } catch (error) {
      logPerformance_('reportRegistrationBatch', 'lock_wait', lockWaitStartedAt, { success: false });
      throw error;
    }
    locked = true;
    lockAcquiredAt = Date.now();

    const readStartedAt = Date.now();
    const allRecords = listRegistrations();
    logPerformance_('reportRegistrationBatch', 'read', readStartedAt, {
      success: true,
      rowCount: allRecords.length
    });
    const recordMap = allRecords.reduce((map, record) => {
      map[record.recordId] = record;
      return map;
    }, {});
    const selectedRecords = recordIds.map((recordId) => {
      const record = recordMap[recordId];
      if (!record) throw new Error(`找不到登記編號：${recordId}`);
      if (isCancelled_(record.paymentStatus)) throw new Error(`${recordId} 已被取消，請重新整理後再送出。`);
      if (!isReportablePaymentStatus_(record.paymentStatus)) throw new Error(`${recordId} 目前狀態不可回報，請重新整理後再送出。`);
      if (record.lineUserId && record.lineUserId !== lineUserId) throw new Error(`${recordId} 不屬於目前 LINE 使用者，請重新整理後再送出。`);
      return record;
    });

    const paymentBatchTotal = selectedRecords.reduce((sum, record) => sum + Number(record.totalAmount || 0), 0);
    const paymentBatchId = generatePaymentBatchId_();
    const now = new Date();
    const patch = {
      paymentStatus: '已回報',
      paymentLast5,
      paymentBatchId,
      paymentBatchTotal,
      receiptRequired: receiptRequired ? '是' : '否',
      receiptStatus: receiptRequired ? '待處理' : '不需收據',
      receiptMode: receiptRequired ? receiptModeLabel_(receiptMode) : '',
      receiptEmail,
      reportedLineUserId: lineUserId,
      reportedProfileName: liffProfileName,
      lineUserId,
      liffProfileName,
      memo: String(payload.memo || '').trim(),
      updatedAt: now
    };

    const writeStartedAt = Date.now();
    const records = updateRegistrationsBatch_(recordIds, patch);
    logPerformance_('reportRegistrationBatch', 'update_write', writeStartedAt, {
      success: true,
      rowCount: recordIds.length
    });
    succeeded = true;
    return {
      ok: true,
      paymentBatchId,
      paymentBatchTotal,
      recordCount: recordIds.length,
      recordIds,
      records: recordIds.map((recordId) => records[recordId]).filter(Boolean)
    };
  } catch (error) {
    if (/Lock|鎖定/.test(String(error && error.message || error))) {
      throw new Error('目前回報人數較多，系統正在排隊處理。請稍後再送出一次。');
    }
    throw error;
  } finally {
    if (locked) {
      lock.releaseLock();
      logPerformance_('reportRegistrationBatch', 'lock_held', lockAcquiredAt, { success: succeeded });
    }
    logPerformance_('reportRegistrationBatch', 'total', totalStartedAt, { success: succeeded });
  }
}

function cancelRegistration(recordId, cancelMemo) {
  requireAdmin_(arguments[2]);
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
  requireAdmin_(arguments[4]);
  return updateRegistration_(recordId, {
    receiptStatus: receiptStatus === 'done' ? '收據已處理' : receiptStatus,
    receiptNo: receiptNo || '',
    receiptDate: receiptDate || '',
    updatedAt: new Date()
  });
}

function resetPaymentStatus(recordId, paymentStatus, memo) {
  requireAdmin_(arguments[3]);
  const statusMap = {
    pending: '待付款',
    reported: '已回報',
    needInfo: '待補件',
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
  requireAdmin_(arguments[3]);
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
    if (!isRegistrationSheetCompatible_(sheet)) {
      migrateExistingRows_(sheet);
    }
    if (sheet.getLastRow() > 1) {
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
  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  const sheet = ss.insertSheet(sheetName);
  initializeRegistrationSheet_(sheet);
  return sheet;
}

function getOrCreateRegistrationSummarySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existing = ss.getSheetByName(SHEETS.registrationSummary)
    || ss.getSheetByName(LEGACY_SHEETS.registrations)
    || ss.getSheetByName(LEGACY_SHEETS.chineseRegistrations);
  if (existing) {
    assertRegistrationSheetCompatible_(existing);
    return existing;
  }

  const sheet = ss.insertSheet(SHEETS.registrationSummary);
  initializeRegistrationSheet_(sheet);
  return sheet;
}

function initializeRegistrationSheet_(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.registrations.length).setValues([HEADERS.registrations]);
  sheet.setFrozenRows(1);
}

function getCaseRegistrationSheetName_(caseId) {
  const safeCaseId = String(caseId || '未分類').replace(/[\\/?*[\]:]/g, '-').slice(0, 30);
  return `${safeCaseId}_捐款登記`;
}

function isCaseRegistrationSheet_(sheetName) {
  return /_捐款登記$/.test(sheetName);
}

function migrateExistingRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.registrations.length);
  if (lastRow < 1) {
    applyHeaders_(sheet, HEADERS.registrations);
    return;
  }

  const oldHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const rows = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
    : [];
  const migrated = rows.map((row) => canonicalRegistrationToRow_(rowToCanonicalObject_(oldHeaders, row)));
  applyHeaders_(sheet, HEADERS.registrations);
  if (migrated.length) {
    sheet.getRange(2, 1, migrated.length, HEADERS.registrations.length).setValues(migrated);
  }
  if (lastColumn > HEADERS.registrations.length) {
    sheet.getRange(1, HEADERS.registrations.length + 1, lastRow, lastColumn - HEADERS.registrations.length).clearContent();
  }
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
    canonical.sourceType || 'self_created',
    canonical.reportedLineUserId,
    canonical.reportedProfileName,
    canonical.paymentLast5,
    canonical.paymentBatchId,
    canonical.paymentBatchTotal,
    canonical.receiptMode,
    canonical.receiptEmail,
    canonical.memo,
    canonical.createdByLineUserId,
    canonical.createdByProfileName
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

function readRegistrationRowsFromSheet_(sheet) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) {
    throw new Error(`登記資料表欄位不相容：${sheet.getName()}。請先執行管理者 migration。`);
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values.shift();
  assertRegistrationHeadersCompatible_(sheet.getName(), headers);
  return values.map((row) => rowToCanonicalObject_(headers, row));
}

function assertRegistrationSheetCompatible_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    throw new Error(`登記資料表欄位不相容：${sheet ? sheet.getName() : '未知工作表'}。請先執行管理者 migration。`);
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  assertRegistrationHeadersCompatible_(sheet.getName(), headers);
}

function isRegistrationSheetCompatible_(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return false;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return REGISTRATION_REQUIRED_FIELDS.every((key) => {
    const aliases = FIELD_ALIASES[key] || [key];
    return findHeaderIndex_(headers, aliases) !== -1;
  });
}

function assertRegistrationHeadersCompatible_(sheetName, headers) {
  const missing = REGISTRATION_REQUIRED_FIELDS.filter((key) => {
    const aliases = FIELD_ALIASES[key] || [key];
    return findHeaderIndex_(headers, aliases) === -1;
  });
  if (missing.length) {
    console.error(`[SCHEMA] incompatible registration sheet: ${sheetName}; missingFields=${missing.join(',')}`);
    throw new Error(`登記資料表欄位不相容：${sheetName}。請先執行管理者 migration。`);
  }
}

function readAllCaseRegistrationRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SHEETS.registrationSummary)
    || ss.getSheetByName(LEGACY_SHEETS.registrations);
  if (summarySheet && summarySheet.getLastRow() > 1) {
    return readRegistrationRowsFromSheet_(summarySheet);
  }

  const caseSheets = ss.getSheets().filter((sheet) => isCaseRegistrationSheet_(sheet.getName()));

  if (caseSheets.length) {
    return caseSheets.flatMap(readRegistrationRowsFromSheet_);
  }

  return summarySheet ? readRegistrationRowsFromSheet_(summarySheet) : [];
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
    sourceType: row.sourceType || 'self_created',
    reportedLineUserId: row.reportedLineUserId || '',
    reportedProfileName: row.reportedProfileName || '',
    paymentLast5: row.paymentLast5 || '',
    paymentBatchId: row.paymentBatchId || '',
    paymentBatchTotal: Number(row.paymentBatchTotal || 0),
    receiptMode: row.receiptMode || '',
    receiptEmail: row.receiptEmail || '',
    createdByLineUserId: row.createdByLineUserId || row.lineUserId || '',
    createdByProfileName: row.createdByProfileName || row.liffProfileName || '',
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

function nextRecordId_(caseId, existingRows) {
  const rows = existingRows || readRegistrationRowsFromSheet_(ensureCaseRegistrationSheet_(caseId));
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

function updateRegistrationsBatch_(recordIds, patch) {
  const targetIds = Array.from(new Set((recordIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  const targetSet = targetIds.reduce((map, recordId) => {
    map[recordId] = true;
    return map;
  }, {});
  const sheets = getRegistrationUpdateSheetsForRecordIds_(targetIds);
  const updated = {};

  sheets.forEach((sheet) => {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    const headers = data[0];
    assertRegistrationHeadersCompatible_(sheet.getName(), headers);
    const idIndex = findHeaderIndex_(headers, FIELD_ALIASES.recordId);
    if (idIndex === -1) return;
    const columnIndexes = Object.keys(patch).reduce((map, key) => {
      map[key] = findHeaderIndex_(headers, FIELD_ALIASES[key] || [key]);
      return map;
    }, {});
    const touchedRowIndexes = [];
    for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
      const recordId = String(data[rowIndex][idIndex] || '').trim();
      if (!targetSet[recordId]) continue;
      Object.keys(patch).forEach((key) => {
        const columnIndex = columnIndexes[key];
        if (columnIndex !== -1) data[rowIndex][columnIndex] = patch[key];
      });
      updated[recordId] = normalizeRegistration_(rowToCanonicalObject_(headers, data[rowIndex]));
      touchedRowIndexes.push(rowIndex);
    }
    writeTouchedRegistrationRows_(sheet, data, touchedRowIndexes, headers.length);
  });

  targetIds.forEach((recordId) => {
    if (!updated[recordId]) throw new Error(`找不到登記編號：${recordId}`);
  });
  return updated;
}

function writeTouchedRegistrationRows_(sheet, data, rowIndexes, columnCount) {
  if (!rowIndexes.length) return;
  const sorted = rowIndexes.slice().sort((left, right) => left - right);
  let groupStart = sorted[0];
  let groupEnd = sorted[0];

  const writeGroup = () => {
    const rows = data.slice(groupStart, groupEnd + 1);
    sheet.getRange(groupStart + 1, 1, rows.length, columnCount).setValues(rows);
  };

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === groupEnd + 1) {
      groupEnd = sorted[index];
      continue;
    }
    writeGroup();
    groupStart = sorted[index];
    groupEnd = sorted[index];
  }
  writeGroup();
}

function getRegistrationUpdateSheetsForRecordIds_(recordIds) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [];
  const seen = {};
  const addSheet = (sheet) => {
    if (!sheet || seen[sheet.getSheetId()]) return;
    seen[sheet.getSheetId()] = true;
    sheets.push(sheet);
  };

  recordIds.forEach((recordId) => {
    const caseId = String(recordId || '').split('-').slice(0, -1).join('-');
    if (caseId) addSheet(ss.getSheetByName(getCaseRegistrationSheetName_(caseId)));
  });
  addSheet(ss.getSheetByName(SHEETS.registrationSummary));

  return sheets;
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
  assertRegistrationHeadersCompatible_(sheet.getName(), headers);
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

function updateCaseCurrentAmount_(caseId, precomputedTotal) {
  const casesSheet = getSheet_(SHEETS.cases, LEGACY_SHEETS.cases);
  const total = typeof precomputedTotal === 'number'
    ? precomputedTotal
    : calculateCaseCurrentAmount_(caseId);

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

function refreshAllCaseCurrentAmounts() {
  const casesSheet = getSheet_(SHEETS.cases, LEGACY_SHEETS.cases);
  const rows = readRowsFromSheet_(casesSheet);
  rows
    .map((row) => row.caseId)
    .filter(Boolean)
    .forEach(updateCaseCurrentAmount_);
  return { ok: true, updated: rows.length };
}

function migrateAllRegistrationSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [];
  const summarySheet = ss.getSheetByName(SHEETS.registrationSummary)
    || ss.getSheetByName(LEGACY_SHEETS.registrations)
    || ss.getSheetByName(LEGACY_SHEETS.chineseRegistrations);
  if (summarySheet) sheets.push(summarySheet);
  ss.getSheets()
    .filter((sheet) => isCaseRegistrationSheet_(sheet.getName()))
    .forEach((sheet) => sheets.push(sheet));
  sheets.forEach(migrateExistingRows_);
  return { ok: true, updated: sheets.length };
}

function calculateCaseCurrentAmount_(caseId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(getCaseRegistrationSheetName_(caseId));
  if (!sheet) return 0;

  return calculateCurrentAmountFromRows_(readRegistrationRowsFromSheet_(sheet), caseId);
}

function calculateCurrentAmountFromRows_(rows, caseId) {
  return (rows || [])
    .filter((row) => row.caseId === caseId)
    .filter((row) => normalizePaymentStatus_(row.paymentStatus) !== '已取消')
    .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
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

function validateCaseStillOpenForRegistration_(caseId, totalAmount, precomputedCurrentAmount) {
  const sheet = getSheet_(SHEETS.cases, LEGACY_SHEETS.cases);
  const rows = readRowsFromSheet_(sheet);
  const target = rows.find((row) => row.caseId === caseId);
  if (!target) throw new Error(`找不到個案：${caseId}`);
  const currentAmount = typeof precomputedCurrentAmount === 'number'
    ? precomputedCurrentAmount
    : calculateCaseCurrentAmount_(caseId);
  if (isCaseClosed_(target) || String(target.status || '').trim() === '已額滿' || !isOpen_(target.opened) || isCaseFull_({ targetAmount: target.targetAmount, currentAmount })) {
    throw new Error('此個案目前已額滿或未開放，請重新選擇個案。');
  }

  const targetAmount = Number(target.targetAmount || 0);
  const remainingAmount = targetAmount > 0 ? targetAmount - currentAmount : 0;
  if (targetAmount > 0 && Number(totalAmount || 0) > remainingAmount) {
    throw new Error(`此個案目前餘額只剩 ${remainingAmount} 元，請調整金額或選擇其他個案。`);
  }
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

function isCaseClosed_(row) {
  const status = String(row && row.status || '').trim();
  return ['已結案', '結案', '關閉', '已關閉', '未開放'].indexOf(status) !== -1 || isYes_(row && row.archived);
}

function isFrontVisibleCase_(row) {
  if (isCaseClosed_(row)) return false;
  return isOpen_(row.opened) || String(row.status || '').trim() === '已額滿' || isCaseFull_(row);
}

function normalizeDuplicateName_(value) {
  return String(value || '').trim().replace(/\s+/g, '').toLowerCase();
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
  if (text === 'needInfo' || text === '資料待補') return '待補件';
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

function isPaymentPending_(value) {
  const status = normalizePaymentStatus_(value);
  return status === '待付款';
}

function isReported_(value) {
  const status = normalizePaymentStatus_(value);
  return status === '已回報';
}

function isCancelled_(value) {
  const status = normalizePaymentStatus_(value);
  return status === '已取消';
}

function isReportablePaymentStatus_(value) {
  return isPaymentPending_(value) || isReported_(value);
}

function generatePaymentBatchId_() {
  const dateText = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const propertyKey = `PAYMENT_BATCH_SEQUENCE_${dateText}`;
  const properties = PropertiesService.getScriptProperties();
  const next = Number(properties.getProperty(propertyKey) || 0) + 1;
  properties.setProperty(propertyKey, String(next));
  return `PB${dateText}${Utilities.formatString('%04d', next)}`;
}

function receiptModeLabel_(value) {
  return {
    representativeTotal: '代表人+總金額',
    eachDonor: '每位捐款人單獨開立',
    annualRepresentativeTotal: '年度開立｜代表人總額',
    perPaymentRepresentativeTotal: '每次開立｜代表人總額',
    annualEachDonor: '年度開立｜每位捐款人單獨開立',
    perPaymentEachDonor: '每次開立｜每位捐款人單獨開立',
    other: '其他開立方式'
  }[String(value || '')] || String(value || '代表人+總金額');
}

function normalizePaymentMethod_(value) {
  const text = String(value || '').trim();
  return PAYMENT_METHOD_LABELS[text] || text || '轉帳';
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
