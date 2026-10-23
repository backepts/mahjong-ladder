# 番仔麻將天梯

麻將群組輸贏的電競風手機網頁：排行榜＋個人戰績卡＋莊家抽頭，以及前台記帳（新增／修改一組）。

## 架構

```
網頁 index.html（GitHub Pages）
   │  GET 讀全部資料／POST 寫一組
   ▼
GAS Web App（Beck 個人 Gmail becktsai0708，任何人可呼叫）
   │  綁定在主表上
   ▼
番仔麻將主表（Beck 個人 Gmail，不公開）
```

- 網頁：https://backepts.github.io/mahjong-ladder/ （repo backepts/mahjong-ladder，main 分支根目錄）
- 主表：https://docs.google.com/spreadsheets/d/1EkTD2nSQJb-I-TTKt-yWxXONxBiioeWF2vq6Nu9GPVY/edit
- GAS 專案：https://script.google.com/d/1SUy_Le7j_IbDYdxhNI9aATm0th1dSoEKFDYyoAdUHYHGHNf9UGD8sMoJ/edit
- Web App 部署 ID：AKfycbwabVzk4EyxWUyB7T08whKnhZ3GB05tgHKFNnR0R1JYz0rT2uCycPMPj9GjfypDN7O3oA（更新程式用 `-i` 部署到同一個 ID，網址不變）
- clasp 一律帶 `-u personal`（個人帳號憑證；預設那組是公司帳號）
- Ralph 的「番仔輸贏表」不再是資料來源，Beck 自己偶爾拿來人工核對

## 主表分頁

| 分頁 | 內容 |
|---|---|
| 對局紀錄 | 一筆一列：場次ID｜日期｜組別｜玩家｜輸贏｜寫入時間（唯一主資料） |
| 抽頭 | 場次ID｜日期｜組別｜每將｜將數｜抽頭｜寫入時間 |
| 玩家 | 名單順序＝總覽列順序；網頁加新人會追加在最後 |
| 修改紀錄 | 時間｜新增／修改｜場次ID｜場次｜記帳人｜改前 JSON｜改後 JSON |
| 總覽 | 每次寫入後由程式重畫，版型同 Ralph 表（人工看用，不要手改） |

- 場次ID＝`日期#組別`（例 `2026-10-23#A`）。同一天第一組永遠是 A；顯示時一天只有一組就寫「10/23」，多組寫「10/23 A」「10/23 B」
- 日期、組別、場次、寫入時間都存純文字（台北時間），避免 Sheets 自動轉日期／時區漂移

## 規則

- 帳平才能寫入：玩家輸贏合計＋抽頭（每將×將數）＝0，前台與後端各檢查一次
- 至少 2 人、金額整數、名字不可重複／不可叫「莊家」「日期」、必須選「我是誰」
- 修改＝整組覆蓋（日期組別不能改），改前內容留在修改紀錄，可照紀錄還原
- 有網址就能寫（Beck 決定不設密碼）

## 檔案

- `index.html` — 前台（排行榜＋記帳）
- `gas/core.js` — 純邏輯（驗證、組別、標籤、總覽版型），`node test/core.test.js` 可本機測
- `gas/Code.js` — 讀寫試算表、doGet/doPost、setup
- `test/core.test.js` — core.js 單元測試

## 目前進度

- 做到哪：記帳功能已上線（main）；「加入主畫面」（manifest＋DUST FISH 貓咪圖示、桌面名稱「番仔碼頭」、底部標註作者）在 `pwa` 分支，已上 LAB 給 Beck 用手機實測，**正式版尚未換**
- 下一步：Beck 手機實測 LAB 加入主畫面 → 同意後 merge pwa → main 並 push
- 等 Beck 決定：圖示實測結果、正式上線
- 改版流程：改 index.html → `python3 tools/build_lab.py` → 把 lab/（＋新增的共用檔如 icons/）帶到 main 推上去給 Beck 看 → 同意才 merge 推 main（push main＝網頁立刻換版；每天 18:00 自動備份也會 push，改到一半一定開分支）
- 圖示來源：DUST FISH 插畫（https://jp.pinterest.com/pin/826480969128407920/），裁切範圍 (130,120)-(630,620)；Beck 決定群組自用、網頁底部標註作者
- 之後再做：「誰跟誰同組時的勝率」分析
