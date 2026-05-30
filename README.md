# 🛸 小蜜蜂防衛戰 (Galaga Bees) - 復古街機遊戲

這是一個使用 **Next.js 15 (App Router)**、**HTML5 Canvas** 與 **Web Audio API** 打造的經典「小蜜蜂 (Galaga)」復古太空射擊街機遊戲。

本專案除了重現了流暢的 60fps 街機射擊手感、敵機編隊及俯衝攻擊外，更結合了極具質感的**復古 CRT 螢幕濾鏡（掃描線與微閃爍效果）**，並利用 Web Audio API 在瀏覽器中即時合成懷舊的 8-bit 電子音效。此外，還設計了完整的積分系統與**本地排行榜 API**。

---

## 🎮 遊戲特色

1. **經典小蜜蜂玩法**：玩家控制星際戰機左右移動，發射雷射消滅一波波襲來的昆蟲敵機。
2. **多樣化敵人行為**：敵機分為三種類型（小蜜蜂、蝴蝶、首領），會進行左右編隊移動，並在特定時間脫離隊伍進行弧形軌跡俯衝突襲。
3. **粒子爆炸效果**：擊毀敵人或玩家戰機被毀時，會觸發炫麗的霓虹色彩粒子擴散與衰減動畫。
4. **即時音效合成**：不依賴任何外部音訊檔案，完全透過瀏覽器 Web Audio API 合成雷射發射、爆炸、受擊及 Game Over 的音樂。
5. **本地排行榜 API**：整合 `GET /api/scores` 與 `POST /api/scores`，將遊玩記錄儲存於本機 JSON 資料庫中，依分數由高至低自動排序，並在提交時自動高亮您的名次。
6. **極致復古視覺**：利用 CSS 打造精緻的虛擬機台結構，模擬 CRT 螢幕彎曲度、掃描線、微小偏色與螢幕 flicker 效果。

---

## ⌨️ 遊戲控制說明

本遊戲支援鍵盤控制，操作方式如下：

| 按鍵 | 操作動作 |
|:---|:---|
| **A** 或 **左方向鍵 (←)** | 戰機向左移動 |
| **D** 或 **右方向鍵 (→)** | 戰機向右移動 |
| **空白鍵 (SPACE)** 或 **K** | 發射雷射 (每秒最高限制 4 發) |

---

## 🚀 快速開始 (本機運行)

確保您的電腦已安裝 **Node.js** (建議版本 v18 以上)。

### 1. 安裝相依套件
在專案根目錄下執行：
```bash
npm install
```

### 2. 啟動開發伺服器
```bash
npm run dev
```
啟動後，請在瀏覽器中開啟 [http://localhost:3000](http://localhost:3000) 即可開始遊玩。

### 3. 編譯生產版本
若要編譯並檢查專案是否可正常打包：
```bash
npm run build
```

---

## 📁 專案核心架構

本專案結構精簡且符合 Next.js 最佳實踐：

```text
week6/
├── app/
│   ├── api/
│   │   └── scores/
│   │       └── route.ts     # 排行榜 API (處理 GET 讀取與 POST 寫入)
│   ├── globals.css          # CRT 濾鏡與霓虹街機機台 Vanilla CSS 樣式
│   ├── layout.tsx           # 全域版面與 SEO 元資料設定
│   └── page.tsx             # 遊戲主頁面 (HTML5 Canvas 繪圖與狀態同步)
├── data/
│   └── scores.json          # 本地高分榜 JSON 資料庫 (自動生成與排序)
├── package.json             # 專案相依套件設定
└── tsconfig.json            # TypeScript 編譯設定
```

---

## 🛠️ 技術實作細節

* **動畫循環 (Tick Loop)**：
  在 `page.tsx` 中使用單一且持續的 `requestAnimationFrame` 循環。利用 React `useRef` 儲存遊戲核心實體（Player、Enemies、Bullets、Particles）以**避免 React 狀態更新的 Stale Closure (閉包過期) 導致的畫面卡死**，並定期將分數與生命同步至 React 狀態以渲染 HUD 與結算畫面。
* **音效合成 (Audio Synthesis)**：
  * *雷射發射*：使用 `sawtooth` (鋸齒波) 振盪器進行頻率從 800Hz 到 100Hz 的快速指數衰減。
  * *爆炸聲*：建立一段隨機白噪音 (White Noise) 緩衝區，並使用 `lowpass` (低通濾波器) 將截止頻率在 0.25 秒內從 800Hz 降至 20Hz。
* **資料持久化**：
  API 端點在寫入分數時會對輸入的 Name (最大 10 字元且自動轉大寫) 和 Score (數值驗證) 進行校驗，排序後截取前 100 筆高分寫回 `data/scores.json`，防止資料無限制增長。
