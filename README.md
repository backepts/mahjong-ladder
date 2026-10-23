# 番仔麻將天梯

麻將群組輸贏表的電競風手機前台。純靜態網頁，每次打開時直接讀 Google Sheet 最新資料，不存任何資料。

## 資料來源

- Sheet：番仔輸贏表（擁有者 Ralph，「知道連結者可檢視」）
  https://docs.google.com/spreadsheets/d/1GkPtdUNP4ofLWIJvZwTFeEUzuhIJA_1qoWf81SPkthI/edit#gid=0
- 讀法：瀏覽器 fetch `export?format=csv&gid=0`（有 CORS，公開表才讀得到）
- 不用 gviz：gviz 會把同欄的文字（莊家 `400*3=1200`）丟掉

## 表格格式假設

```
A1 = 日期 │ B1… = 每場日期（往右加）
A 欄      │ 玩家名稱；空白列略過
莊家 列   │ 「每將*將數=金額」或純數字；取等號後的數字當抽頭
```

## 計算規則

- 累計輸贏＝每場數字直接相加（正＝贏），空白＝沒出賽
- 排名只算有出賽的人；第 1 名「雀王」、2～3 名「鑽石」、最後一名「慈善家」、其餘「白銀」
- 帳平檢查：每天「玩家輸贏合計＋莊家抽頭」應為 0，不為 0 會在莊家那天標「帳不平」
- 非數字的格子不計入，畫面底部會列出是哪幾格

## 檔案

- `index.html` — 整個前台（HTML＋CSS＋JS 一檔）

## 目前進度

- 做到哪：已上線 https://backepts.github.io/mahjong-ladder/ （repo backepts/mahjong-ladder，main 分支根目錄）；線上數字已驗證
- 下一步：無；改版改 index.html → commit → push 即自動更新（約 1 分鐘）
- 等 Beck 決定：無
