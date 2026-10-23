// 番仔麻將主表後端：Web App（任何人可用），讀寫綁定的這張試算表

var SHEET = {
  results: '對局紀錄',
  house: '抽頭',
  players: '玩家',
  log: '修改紀錄',
  overview: '總覽'
};
var HEADERS = {
  results: ['場次ID', '日期', '組別', '玩家', '輸贏', '寫入時間'],
  house: ['場次ID', '日期', '組別', '每將', '將數', '抽頭', '寫入時間', '開局', '結束'],
  players: ['玩家', '加入日期', '造型'],
  log: ['時間', '動作', '場次ID', '場次', '記帳人', '改前', '改後']
};
var INITIAL_PLAYERS = ['Congo', 'Rick', 'Yuan', 'PP', 'Joy', 'Poting', 'Ralph', 'Amy', 'Ariel', 'Albee', 'Ivy'];
// 戰況回顧的像素造型（玩家分頁 C 欄）；第一次讀到沒有 C 欄表頭時填入，之後直接改那一格就好，空白＝網頁自動配
var INITIAL_STYLES = {
  Congo: '光頭', Rick: '綠巨人', Yuan: '企鵝', PP: '口罩男', Joy: '女馬尾', Poting: '高爾夫',
  Ralph: '哥布林', Amy: '女長髮', Ariel: '女長髮', Albee: '女長髮', Ivy: '女長髮'
};

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(key) {
  var sh = ss_().getSheetByName(SHEET[key]);
  if (!sh) throw new Error('找不到分頁：' + SHEET[key] + '（請先執行 setup）');
  return sh;
}

function rows_(key) {
  var sh = sheet_(key);
  var n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, sh.getLastColumn()).getValues() : [];
}

function readState_() {
  var prows = rows_('players').filter(function (r) { return String(r[0]).trim(); });
  var players = prows.map(function (r) { return String(r[0]).trim(); });
  var styles = {};
  prows.forEach(function (r) { if (r[2] && String(r[2]).trim()) styles[String(r[0]).trim()] = String(r[2]).trim(); });
  var byId = {};
  rows_('house').forEach(function (r) {
    var id = String(r[0]);
    byId[id] = { id: id, date: String(r[1]), group: String(r[2]), per: Number(r[3]), rounds: Number(r[4]), house: Number(r[5]), start: String(r[7] || ''), end: String(r[8] || ''), results: [] };
  });
  rows_('results').forEach(function (r) {
    var s = byId[String(r[0])];
    if (s) s.results.push({ name: String(r[3]), amt: Number(r[4]) });
  });
  var sessions = labelSessions(sortSessions(Object.keys(byId).map(function (k) { return byId[k]; })));
  return { players: players, styles: styles, sessions: sessions };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 時區固定台北；修改紀錄的「場次」欄（10/21 這種）存純文字，避免被 Sheets 自動轉成日期。已修好就只花兩次讀取
function ensureFormat_(st) {
  var ss = ss_();
  if (ss.getSpreadsheetTimeZone() !== 'Asia/Taipei') ss.setSpreadsheetTimeZone('Asia/Taipei');
  fixTimestamps_();
  seedStyles_();
  ensureTimeCols_();
  var log = sheet_('log');
  if (log.getRange('D1').getNumberFormat() === '@') return;
  log.getRange('D:D').setNumberFormat('@');
  var n = log.getLastRow() - 1;
  if (n > 0) {
    var labels = {};
    (st || readState_()).sessions.forEach(function (s) { labels[s.id] = s.label; });
    var ids = log.getRange(2, 3, n, 1).getValues();
    log.getRange(2, 4, n, 1).setValues(ids.map(function (r) { return [labels[String(r[0])] || String(r[0])]; }));
  }
  writeOverview_(st || readState_());
}

// ---------- 付款碼 ----------
// 圖放在 Beck 個人雲端硬碟「番仔碼頭付款碼」（不分享），檔名＝玩家名字（Yuan.png 之類）；密語存在指令碼屬性 PAY_PASS
var PAY_FOLDER_ID = '1YgwzG2tx-tkdFYxKpw3La72p5W5jaFvy';

function checkPass_(pass) {
  var real = PropertiesService.getScriptProperties().getProperty('PAY_PASS');
  if (!real) return '還沒設定通關密語';
  if (String(pass || '') !== real) { Utilities.sleep(1500); return '密語不對，再試一次'; }
  return '';
}

// 第一次直接設；之後要換必須帶對舊密語（old）。也可以到「專案設定 → 指令碼屬性」直接改 PAY_PASS
function setPass_(payload) {
  var props = PropertiesService.getScriptProperties();
  var cur = props.getProperty('PAY_PASS');
  if (cur && String(payload.old || '') !== cur) { Utilities.sleep(1500); return { ok: false, error: '舊密語不對' }; }
  var pass = String(payload.pass || '');
  if (pass.length < 4) return { ok: false, error: '密語至少 4 個字' };
  props.setProperty('PAY_PASS', pass);
  return { ok: true };
}

// 「付款資料」分頁：玩家｜銀行｜帳號（全部純文字，帳號開頭的 0 才不會被吃掉）；只在密語對時回傳，排行榜讀資料時不會帶出去
function payInfoSheet_() {
  var ss = ss_(), sh = ss.getSheetByName('付款資料');
  if (!sh) {
    sh = ss.insertSheet('付款資料');
    sh.getRange('A:C').setNumberFormat('@');
    sh.getRange(1, 1, 1, 3).setValues([['玩家', '銀行', '帳號']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function payInfo_(name) {
  var sh = payInfoSheet_(), n = sh.getLastRow() - 1;
  var rows = n > 0 ? sh.getRange(2, 1, n, 3).getDisplayValues() : [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0].trim().toLowerCase() === name.toLowerCase() && rows[i][2].trim()) return { bank: rows[i][1].trim(), account: rows[i][2].replace(/\s/g, '') };
  }
  return null;
}

function payQr_(payload) {
  var err = checkPass_(payload.pass);
  if (err) return { ok: false, error: err, badPass: true };
  var name = String(payload.name || '').trim();
  var info = payInfo_(name);
  var files = DriveApp.getFolderById(PAY_FOLDER_ID).getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.isTrashed()) continue;  // 換圖時舊檔丟垃圾桶，資料夾清單仍列得到它
    if (f.getName().replace(/\.[^.]+$/, '').trim().toLowerCase() !== name.toLowerCase()) continue;
    var blob = f.getBlob();
    return { ok: true, has: true, name: name, info: info, img: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  }
  return { ok: true, has: !!info, name: name, info: info, img: '' };
}

// 第一次加雲端硬碟權限時，Beck 在編輯器手動執行這支，讓 Google 跳出授權
function authorizeDrive() {
  Logger.log('付款碼資料夾：' + DriveApp.getFolderById(PAY_FOLDER_ID).getName());
}

var STYLES = ['男短髮', '男刺蝟頭', '光頭', '女長髮', '女短髮', '女馬尾', '口罩男', '企鵝', '哥布林', '綠巨人', '高爾夫', '高爾夫女'];

// 改某人的造型（Beck 跟 Claude 說要換時用）；空字串＝改回自動配
function setStyle_(payload) {
  var name = String(payload.name || '').trim(), style = String(payload.style || '').trim();
  if (style && STYLES.indexOf(style) < 0) return { ok: false, error: '不認得的造型：' + style };
  var ps = sheet_('players'), n = ps.getLastRow() - 1;
  var names = n > 0 ? ps.getRange(2, 1, n, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  var i = names.indexOf(name);
  if (i < 0) return { ok: false, error: '找不到玩家：' + name };
  var cell = ps.getRange(i + 2, 3), before = String(cell.getValue());
  cell.setValue(style);
  sheet_('log').appendRow([ts_(), '改造型', '', '', String(payload.by || ''), JSON.stringify({ name: name, style: before }), JSON.stringify({ name: name, style: style })]);
  return { ok: true, name: name, style: style };
}

// 抽頭分頁 H、I 欄＝開局、結束（純文字 HH:MM，避免被轉成時間格式）
function ensureTimeCols_() {
  var hs = sheet_('house');
  if (String(hs.getRange('H1').getValue()) === '開局') return;
  hs.getRange('H:I').setNumberFormat('@');
  hs.getRange('H1:I1').setValues([['開局', '結束']]).setFontWeight('bold');
}

function seedStyles_() {
  var ps = sheet_('players');
  if (String(ps.getRange('C1').getValue()) === '造型') return;
  ps.getRange('C1').setValue('造型').setFontWeight('bold');
  var n = ps.getLastRow() - 1;
  if (n > 0) {
    var names = ps.getRange(2, 1, n, 1).getValues();
    ps.getRange(2, 3, n, 1).setValues(names.map(function (r) { return [INITIAL_STYLES[String(r[0]).trim()] || '']; }));
  }
}

// 寫入時間一律存台北時間文字，不受試算表時區影響
function ts_(d) {
  return Utilities.formatDate(d || new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
}

// 一次性：2026-10-23 首批資料寫入時試算表時區還是美西（UTC-7），留下的是美西牆上時間的日期格。
// 時區改成台北後讀回來會少 15 小時，所以轉成文字時補回 15 小時；之後寫入都是文字，不會再進來
var TS_COLS = { results: 'F', house: 'G', log: 'A' };
function fixTimestamps_() {
  Object.keys(TS_COLS).forEach(function (key) {
    var sh = sheet_(key), col = TS_COLS[key];
    if (sh.getRange(col + '1').getNumberFormat() === '@') return;
    var n = sh.getLastRow() - 1;
    var vals = n > 0 ? sh.getRange(col + '2:' + col + (n + 1)).getValues() : [];
    sh.getRange(col + ':' + col).setNumberFormat('@');
    if (n > 0) {
      sh.getRange(col + '2:' + col + (n + 1)).setValues(vals.map(function (r) {
        return [r[0] instanceof Date ? ts_(new Date(r[0].getTime() + 15 * 3600 * 1000)) : r[0]];
      }));
    }
  });
}

function doGet() {
  try {
    var st = readState_();
    ensureFormat_(st);
    return json_({ ok: true, players: st.players, styles: st.styles, sessions: st.sessions });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // 讀付款碼不寫表，不用排隊拿鎖（密語錯會故意等 1.5 秒，不該卡住記帳）
    if (payload.action === 'qr') return json_(payQr_(payload));
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (payload.action === 'style') return json_(setStyle_(payload));
    if (payload.action === 'setpass') return json_(setPass_(payload));
    if (payload.action !== 'save') return json_({ ok: false, error: '不認得的動作' });
    var res = saveSession_(payload);
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function saveSession_(payload) {
  var st = readState_();
  ensureFormat_(st);
  var prep = prepareSave(payload, st);
  if (prep.error) return { ok: false, error: prep.error };
  var s = prep.session, now = new Date(), stamp = ts_(now);

  if (prep.before) deleteSessionRows_(s.id);

  if (prep.newPlayers.length) {
    var today = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd');
    var ps = sheet_('players');
    ps.getRange(ps.getLastRow() + 1, 1, prep.newPlayers.length, 2)
      .setValues(prep.newPlayers.map(function (n) { return [n, today]; }));
  }

  var rs = sheet_('results');
  rs.getRange(rs.getLastRow() + 1, 1, s.results.length, 6)
    .setValues(s.results.map(function (r) { return [s.id, s.date, s.group, r.name, r.amt, stamp]; }));
  var hs = sheet_('house');
  hs.getRange(hs.getLastRow() + 1, 1, 1, 9).setValues([[s.id, s.date, s.group, s.per, s.rounds, s.house, stamp, s.start, s.end]]);

  var after = readState_();
  var saved = after.sessions.filter(function (x) { return x.id === s.id; })[0];
  sheet_('log').appendRow([
    stamp, prep.before ? '修改' : '新增', s.id, saved.label, prep.by,
    prep.before ? JSON.stringify(stripSession_(prep.before)) : '',
    JSON.stringify(stripSession_(saved))
  ]);
  writeOverview_(after);
  return { ok: true, id: s.id, label: saved.label };
}

function stripSession_(s) {
  return { per: s.per, rounds: s.rounds, house: s.house, start: s.start || '', end: s.end || '', results: s.results };
}

function deleteSessionRows_(id) {
  ['results', 'house'].forEach(function (key) {
    var sh = sheet_(key);
    var ids = rows_(key).map(function (r) { return String(r[0]); });
    for (var i = ids.length - 1; i >= 0; i--) if (ids[i] === id) sh.deleteRow(i + 2);
  });
}

function writeOverview_(st) {
  var grid = buildOverview(st.players, st.sessions);
  var sh = ss_().getSheetByName(SHEET.overview) || ss_().insertSheet(SHEET.overview);
  sh.clearContents();
  sh.getRange(1, 1, 1, sh.getMaxColumns()).setNumberFormat('@');
  sh.getRange(1, 1, grid.length, grid[0].length).setValues(grid);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
}

// 第一次手動執行：建分頁＋表頭＋初始玩家；同時讓 Google 跳出授權。重複執行不會蓋掉資料
function setup() {
  var ss = ss_();
  Object.keys(HEADERS).forEach(function (key) {
    var sh = ss.getSheetByName(SHEET[key]);
    if (!sh) {
      var blank = ss.getSheets().filter(function (x) { return x.getLastRow() === 0 && Object.keys(SHEET).every(function (k) { return SHEET[k] !== x.getName(); }); })[0];
      sh = blank ? blank.setName(SHEET[key]) : ss.insertSheet(SHEET[key]);
    }
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[key].length).setValues([HEADERS[key]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    // 場次ID、日期、組別存純文字，避免被自動轉成日期
    if (key === 'results' || key === 'house') sh.getRange('A:C').setNumberFormat('@');
    if (key === 'players') sh.getRange('B:B').setNumberFormat('@');
  });
  ss.getSheetByName(SHEET.log).getRange('D:D').setNumberFormat('@');
  ss.setSpreadsheetTimeZone('Asia/Taipei');
  var ps = ss.getSheetByName(SHEET.players);
  if (ps.getLastRow() === 1) {
    ps.getRange(2, 1, INITIAL_PLAYERS.length, 2).setValues(INITIAL_PLAYERS.map(function (n) { return [n, '2026-10-21']; }));
  }
  writeOverview_(readState_());
  Logger.log('setup 完成：' + ss.getUrl());
}
