// node test/core.test.js
const assert = require('assert');
const C = require('../gas/core.js');

const players = ['Rick', 'Yuan', 'PP', 'Ralph'];
const s1 = { id: '2026-10-21#A', date: '2026-10-21', group: 'A', per: 400, rounds: 3, house: 1200, results: [{ name: 'Rick', amt: 2500 }, { name: 'Ralph', amt: -3700 }] };
const state = () => ({ players: players.slice(), sessions: [JSON.parse(JSON.stringify(s1))] });
const ok = { by: 'Yuan', date: '2026-10-22', per: 400, rounds: 5, results: [{ name: 'Yuan', amt: 5550 }, { name: 'Rick', amt: -7550 }] };

// 標籤：單組只顯示日期，多組加組別
let ls = C.labelSessions([{ date: '2026-10-21', group: 'A' }]);
assert.strictEqual(ls[0].label, '10/21');
ls = C.labelSessions([{ date: '2026-10-21', group: 'A' }, { date: '2026-10-21', group: 'B' }, { date: '2026-01-05', group: 'A' }]);
assert.deepStrictEqual(ls.map(s => s.label), ['10/21 A', '10/21 B', '1/5']);

// 下一組字母
assert.strictEqual(C.nextGroup('2026-10-21', state().sessions), 'B');
assert.strictEqual(C.nextGroup('2026-10-22', state().sessions), 'A');

// 正常新增
let r = C.prepareSave(ok, state());
assert.ifError(r.error);
assert.strictEqual(r.session.id, '2026-10-22#A');
assert.strictEqual(r.session.house, 2000);
assert.deepStrictEqual(r.newPlayers, []);

// 同天第二組
r = C.prepareSave(Object.assign({}, ok, { date: '2026-10-21', rounds: 5 }), state());
assert.strictEqual(r.session.id, '2026-10-21#B');

// 新玩家
r = C.prepareSave(Object.assign({}, ok, { results: [{ name: ' 新朋友 ', amt: 5550 }, { name: 'Rick', amt: -7550 }] }), state());
assert.deepStrictEqual(r.newPlayers, ['新朋友']);

// 擋：帳不平、沒記帳人、少於 2 人、重複、非整數、莊家當名字、日期錯
const bad = [
  [{ rounds: 4 }, '帳不平'],
  [{ by: '' }, '我是誰'],
  [{ results: [{ name: 'Yuan', amt: -2000 }] }, '至少要 2'],
  [{ results: [{ name: 'Yuan', amt: 5550 }, { name: 'Yuan', amt: -7550 }] }, '重複'],
  [{ results: [{ name: 'Yuan', amt: 5550.5 }, { name: 'Rick', amt: -7550.5 }] }, '金額不對'],
  [{ results: [{ name: '莊家', amt: 5550 }, { name: 'Rick', amt: -7550 }] }, '不能用'],
  [{ date: '2026/10/22' }, '日期'],
  [{ per: -1 }, '每將'],
];
bad.forEach(([patch, msg]) => {
  const res = C.prepareSave(Object.assign({}, ok, patch), state());
  assert.ok(res.error && res.error.includes(msg), JSON.stringify(patch) + ' → ' + res.error);
});

// 修改：沿用原本日期組別，帶出改前
r = C.prepareSave({ id: '2026-10-21#A', by: 'Yuan', date: '2099-01-01', per: 400, rounds: 3, results: [{ name: 'Rick', amt: 1000 }, { name: 'Ralph', amt: -2200 }] }, state());
assert.ifError(r.error);
assert.strictEqual(r.session.id, '2026-10-21#A');
assert.strictEqual(r.before.results[0].amt, 2500);
assert.ok(C.prepareSave({ id: 'nope', by: 'Yuan', per: 0, rounds: 0, results: ok.results }, state()).error.includes('找不到'));

// 總覽版型
const grid = C.buildOverview(players, state().sessions);
assert.deepStrictEqual(grid[0], ['日期', '10/21']);
assert.deepStrictEqual(grid[1], ['Rick', 2500]);
assert.deepStrictEqual(grid[2], ['Yuan', '']);
assert.deepStrictEqual(grid[grid.length - 1], ['莊家', '400*3=1200']);
assert.strictEqual(grid.length, 1 + players.length + 3);

console.log('全部通過');
