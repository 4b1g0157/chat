## Context

本專案是一個全新的端對端加密（E2EE）即時聊天系統，目標是作為畢業專案的展示。本系統包含 React 前端與 Flask 後端，兩者透過 REST API（JWT 登入與金鑰分發）與 Socket.IO（即時訊息傳遞）進行整合。本設計文件將說明如何實作高安全性的端對端加密，並說明相關密碼學演算法與實作選擇的背後邏輯。

## Goals / Non-Goals

**Goals:**
- **端對端加密 (E2EE)**：確保聊天明文僅存在於發送端與接收端的記憶體中，伺服器與資料庫僅能存取與儲存密文。
- **安全的私鑰保管**：使用者私鑰使用基於其自訂 Passphrase 衍生的 KEK 加密後備份於資料庫，確保能在不同裝置登入，且伺服器無法還原私鑰。
- **即時通訊**：使用 Socket.IO 達到毫秒級的訊息收發。
- **安全視覺化調試面板**：在 React UI 上清楚展示金鑰交換與加解密流程，以利畢業專題 Demo。

**Non-Goals:**
- **多裝置金鑰同步與協商**：本系統聚焦於單一瀏覽器 Session 的金鑰加解密，不處理如 Signal 的雙重棘輪演算法（Double Ratchet）或多裝置金鑰同步。
- **群組聊天（Group Chat）**：此設計僅適用於 1-on-1 私聊。
- **正式的 HTTPS/WSS 憑證配置**：開發與展示皆以 `http://localhost` 本地端測試為主。

## Decisions

### 1. 密碼學實作：Web Crypto API 替代第三方庫
- **選擇**：使用瀏覽器原生內建的 **Web Crypto API**。
- **原因**：Web Crypto API 是由瀏覽器底層（通常是 C++）實作，相較於 `crypto-js` 或 `forge` 等 JavaScript 實作的密碼庫，它能有效抵禦定時攻擊（Timing Attacks）等側信道攻擊，且效能極佳，不需額外引入體積龐大的 NPM 套件。

### 2. 金鑰交換協議：RSA-OAEP + AES-GCM
- **選擇**：
  - 非對稱加密（金鑰交換）：**RSA-OAEP (2048-bit)**
  - 對稱加密（訊息加密）：**AES-GCM (256-bit)**
- **原因**：AES-GCM 提供 AEAD（Authenticated Encryption with Associated Data），在加密的同時提供完整性校驗，能防止密文在傳輸過程中被惡意篡改。RSA-OAEP 比起舊有的 RSA-PKCS1-v1_5 具有更強的抗選擇密文攻擊（CCA）能力。

### 3. 私鑰託管設計：伺服器端儲存加密私鑰
- **選擇**：將私鑰用使用者自訂的 Passphrase 透過 PBKDF2 (100,000 iterations, SHA-256) 衍生出 AES-256 金鑰加密，然後將密文備份於伺服器。
- **原因**：若只將私鑰存於本地 `localStorage`，一旦使用者更換瀏覽器或清除快取，私鑰即永久丟失且無法讀取舊訊息。此方案在維持「伺服器零知識」的前提下，提供了跨瀏覽器登入的便利性。

### 4. 即時通訊技術：Socket.IO
- **選擇**：使用 `Flask-SocketIO` 與 `socket.io-client`。
- **原因**：Socket.IO 提供了自動重連、Room 管理以及 Fallback 機制（如 HTTP Long Polling），在即時私聊房間的實作上比純 WebSocket 更穩定且開發速度更快。

## Risks / Trade-offs

- **[Risk] XSS 攻擊竊取記憶體中的私鑰**
  - *Mitigation*: React 預設具備防止 XSS 的機制（自動逸出 HTML）。前端程式碼中應避免使用 `dangerouslySetInnerHTML`。JWT 應使用帶有 `HttpOnly` 的 Cookie 儲存（或在專題展示中簡單存於記憶體，減少複雜度）。
- **[Risk] 使用者設定了過於簡單的 Passphrase**
  - *Mitigation*: 前端註冊時加強強密碼校驗（例如：至少 8 碼，包含大小寫字母與數字），防止 Passphrase 被暴力破解。
- **[Risk] Socket.IO 連線未加密 (WS)**
  - *Mitigation*: 雖然 Socket 連線在本地端是明文，但因為通訊內容本身（`ciphertext` 與 `encrypted_aes_key`）在應用層已經用 RSA 與 AES 加密，因此即使用戶連線被攔截，竊聽者也完全無法獲知聊天明文。
