// 純邏輯（不碰 SpreadsheetApp），本機可用 node 跑 test/core.test.js 驗證

var HOUSE_NAME = '莊家';
var MAX_NAME_LEN = 20;
var MAX_AMOUNT = 1000000;

function trimStr_(s) {
  return String(s == null ? '' : s).trim();
}

// '2026-10-23' → '10/23'
function shortDate_(date) {
  var p = date.split('-');
  return Number(p[1]) + '/' + Number(p[2]);
}

// 同一天只有一組就顯示「10/23」，多組顯示「10/23 A」「10/23 B」
function labelSessions(sessions) {
  var count = {};
  sessions.forEach(function (s) { count[s.date] = (count[s.date] || 0) + 1; });
  sessions.forEach(function (s) {
    s.label = shortDate_(s.date) + (count[s.date] > 1 ? ' ' + s.group : '');
  });
  return sessions;
}

function sortSessions(sessions) {
  return sessions.sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : a.group < b.group ? -1 : a.group > b.group ? 1 : 0;
  });
}

function nextGroup(date, sessions) {
  var used = sessions.filter(function (s) { return s.date === date; }).map(function (s) { return s.group; });
  for (var i = 0; i < 26; i++) {
    var g = String.fromCharCode(65 + i);
    if (used.indexOf(g) < 0) return g;
  }
  return null;
}

// 驗證送出內容；成功回 { session, newPlayers, before }，失敗回 { error }
function prepareSave(payload, state) {
  payload = payload || {};
  var by = trimStr_(payload.by);
  if (!by) return { error: '請先選「我是誰」' };
  if (by.length > MAX_NAME_LEN) return { error: '記帳人名稱太長' };

  var before = null, date, group;
  if (payload.id) {
    before = state.sessions.filter(function (s) { return s.id === payload.id; })[0];
    if (!before) return { error: '找不到要修改的那一組，可能已被別人改過，請重新整理' };
    date = before.date;
    group = before.group;
  } else {
    date = trimStr_(payload.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00').getTime())) return { error: '日期格式不對' };
    group = nextGroup(date, state.sessions);
    if (!group) return { error: '這一天的組數太多了' };
  }

  var results = Array.isArray(payload.results) ? payload.results : [];
  if (results.length < 2) return { error: '至少要 2 個人' };
  var seen = {}, clean = [];
  for (var i = 0; i < results.length; i++) {
    var name = trimStr_(results[i] && results[i].name);
    var amt = Number(results[i] && results[i].amt);
    if (!name) return { error: '有玩家沒有名字' };
    if (name.length > MAX_NAME_LEN) return { error: '名字太長：' + name };
    if (name === HOUSE_NAME || name === '日期') return { error: '不能用「' + name + '」當玩家名字' };
    if (seen[name]) return { error: '重複的玩家：' + name };
    seen[name] = true;
    if (!Number.isInteger(amt) || Math.abs(amt) > MAX_AMOUNT) return { error: name + ' 的金額不對' };
    clean.push({ name: name, amt: amt });
  }

  var per = Number(payload.per), rounds = Number(payload.rounds);
  if (!Number.isInteger(per) || per < 0 || per > MAX_AMOUNT) return { error: '每將金額不對' };
  if (!Number.isInteger(rounds) || rounds < 0 || rounds > 100) return { error: '將數不對' };
  var house = per * rounds;

  var sum = clean.reduce(function (a, r) { return a + r.amt; }, 0);
  if (sum + house !== 0) return { error: '帳不平：玩家合計 ' + sum + '＋東錢 ' + house + '＝' + (sum + house) };

  var newPlayers = clean.map(function (r) { return r.name; })
    .filter(function (n) { return state.players.indexOf(n) < 0; });

  return {
    session: { id: date + '#' + group, date: date, group: group, per: per, rounds: rounds, house: house, results: clean },
    newPlayers: newPlayers,
    before: before || null,
    by: by
  };
}

// 產生跟 Ralph 表同樣版型的總覽：A1 日期、玩家一列、空兩列、莊家列
function buildOverview(players, sessions) {
  sessions = labelSessions(sortSessions(sessions.slice()));
  var grid = [['日期'].concat(sessions.map(function (s) { return s.label; }))];
  players.forEach(function (p) {
    grid.push([p].concat(sessions.map(function (s) {
      var r = s.results.filter(function (x) { return x.name === p; })[0];
      return r ? r.amt : '';
    })));
  });
  var blank = sessions.map(function () { return ''; });
  grid.push([''].concat(blank));
  grid.push([''].concat(blank));
  grid.push([HOUSE_NAME].concat(sessions.map(function (s) { return s.per + '*' + s.rounds + '=' + s.house; })));
  return grid;
}

if (typeof module !== 'undefined') {
  module.exports = { labelSessions: labelSessions, sortSessions: sortSessions, nextGroup: nextGroup, prepareSave: prepareSave, buildOverview: buildOverview };
}
