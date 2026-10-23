"""從 index.html 產生 lab/index.html：讀真資料，但「送出」只在瀏覽器裡模擬，不寫進主表。

用法：python3 tools/build_lab.py
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / 'index.html').read_text(encoding='utf-8')

BANNER = ('<div style="background:#facc15;color:#3b2f00;border-radius:10px;padding:8px 12px;'
          'font-size:13px;margin-bottom:14px;text-align:center"><b>LAB 測試版</b>｜送出不會寫進真的表，重新整理就還原</div>')

# 攔截 fetch：第一次 GET 拿真資料存起來；之後 GET 回傳記憶體裡的版本；POST 用 core.js 同一套驗證後套用到記憶體
MOCK = """<script src="core.js"></script>
<script>
(function () {
  const realFetch = window.fetch.bind(window);
  const reply = obj => Promise.resolve(new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json' } }));
  let state = null;
  window.fetch = async (url, opt) => {
    if (!state) {
      const r = await realFetch(String(url).split('?')[0] + '?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) return reply(j);
      state = { players: j.players, sessions: j.sessions };
    }
    if (opt && opt.method === 'POST') {
      const prep = prepareSave(JSON.parse(opt.body), JSON.parse(JSON.stringify(state)));
      if (prep.error) return reply({ ok: false, error: prep.error });
      state.sessions = state.sessions.filter(s => s.id !== prep.session.id).concat([prep.session]);
      state.players = state.players.concat(prep.newPlayers);
      labelSessions(sortSessions(state.sessions));
      return reply({ ok: true, id: prep.session.id, label: prep.session.label + '（LAB 模擬）' });
    }
    return reply({ ok: true, players: state.players.slice(), sessions: JSON.parse(JSON.stringify(state.sessions)) });
  };
})();
</script>
"""

anchor_script = '<script>\nconst API_URL'
anchor_wrap = '<div class="wrap">\n'
assert src.count(anchor_script) == 1 and src.count(anchor_wrap) == 1, '找不到插入點，index.html 結構變了'

out = src.replace(anchor_wrap, anchor_wrap + '  ' + BANNER + '\n').replace(anchor_script, MOCK + anchor_script)
out = out.replace('<title>番仔麻將天梯</title>', '<title>番仔麻將天梯 LAB</title>')
(ROOT / 'lab').mkdir(exist_ok=True)
(ROOT / 'lab' / 'index.html').write_text(out, encoding='utf-8')
shutil.copy(ROOT / 'gas' / 'core.js', ROOT / 'lab' / 'core.js')
print('lab/ 已產生')
