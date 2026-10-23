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
  house: ['場次ID', '日期', '組別', '每將', '將數', '抽頭', '寫入時間'],
  players: ['玩家', '加入日期'],
  log: ['時間', '動作', '場次ID', '場次', '記帳人', '改前', '改後']
};
var INITIAL_PLAYERS = ['Congo', 'Rick', 'Yuan', 'PP', 'Joy', 'Poting', 'Ralph', 'Amy', 'Ariel', 'Albee', 'Ivy'];

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
  var players = rows_('players').map(function (r) { return String(r[0]).trim(); }).filter(String);
  var byId = {};
  rows_('house').forEach(function (r) {
    var id = String(r[0]);
    byId[id] = { id: id, date: String(r[1]), group: String(r[2]), per: Number(r[3]), rounds: Number(r[4]), house: Number(r[5]), results: [] };
  });
  rows_('results').forEach(function (r) {
    var s = byId[String(r[0])];
    if (s) s.results.push({ name: String(r[3]), amt: Number(r[4]) });
  });
  var sessions = labelSessions(sortSessions(Object.keys(byId).map(function (k) { return byId[k]; })));
  return { players: players, sessions: sessions };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try {
    var st = readState_();
    return json_({ ok: true, players: st.players, sessions: st.sessions });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
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
  var prep = prepareSave(payload, st);
  if (prep.error) return { ok: false, error: prep.error };
  var s = prep.session, now = new Date();

  if (prep.before) deleteSessionRows_(s.id);

  if (prep.newPlayers.length) {
    var today = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd');
    var ps = sheet_('players');
    ps.getRange(ps.getLastRow() + 1, 1, prep.newPlayers.length, 2)
      .setValues(prep.newPlayers.map(function (n) { return [n, today]; }));
  }

  var rs = sheet_('results');
  rs.getRange(rs.getLastRow() + 1, 1, s.results.length, 6)
    .setValues(s.results.map(function (r) { return [s.id, s.date, s.group, r.name, r.amt, now]; }));
  var hs = sheet_('house');
  hs.getRange(hs.getLastRow() + 1, 1, 1, 7).setValues([[s.id, s.date, s.group, s.per, s.rounds, s.house, now]]);

  var after = readState_();
  var saved = after.sessions.filter(function (x) { return x.id === s.id; })[0];
  sheet_('log').appendRow([
    now, prep.before ? '修改' : '新增', s.id, saved.label, prep.by,
    prep.before ? JSON.stringify(stripSession_(prep.before)) : '',
    JSON.stringify(stripSession_(saved))
  ]);
  writeOverview_(after);
  return { ok: true, id: s.id, label: saved.label };
}

function stripSession_(s) {
  return { per: s.per, rounds: s.rounds, house: s.house, results: s.results };
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
  var ps = ss.getSheetByName(SHEET.players);
  if (ps.getLastRow() === 1) {
    ps.getRange(2, 1, INITIAL_PLAYERS.length, 2).setValues(INITIAL_PLAYERS.map(function (n) { return [n, '2026-10-21']; }));
  }
  writeOverview_(readState_());
  Logger.log('setup 完成：' + ss.getUrl());
}
