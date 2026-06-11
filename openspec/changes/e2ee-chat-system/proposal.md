## Why

本專案旨在為畢業專案建立一個「端對端加密（E2EE）即時聊天系統」。在現今的通訊軟體中，隱私洩漏與伺服器被駭導致的聊天紀錄外流是重大的安全威脅。此專案透過結合前端（React）密碼學計算與後端（Flask + Socket.IO）即時通訊，實作「伺服器零知識（Zero-Knowledge Server）」的加密聊天機制，並設計「安全調試視覺化面板」供畢業專題評審與口試進行高質感的技術展示。

## What Changes

本專案將從零開始建立完整的端對端加密即時聊天系統：
- **新增** React 前端專案：包含使用者登入/註冊介面、即時聊天室、金鑰產生器以及「安全視覺化調試面板」。
- **新增** Flask API 後端專案：提供 JWT 身份驗證、使用者公鑰與加密私鑰查詢 API。
- **新增** Flask-SocketIO 即時通訊模組：處理即時訊息廣播與轉發（不解密訊息，僅轉發密文與加密後的金鑰包）。
- **新增** 資料庫結構：儲存使用者雜湊密碼、RSA 公鑰、加密的 RSA 私鑰、加密訊息密文 (AES-GCM-256) 以及對應的金鑰包。

## Capabilities

### New Capabilities
- `user-auth-crypto`: 處理使用者註冊、JWT 登入，並在前端生成 RSA 金鑰對、將私鑰經 Passphrase 衍生金鑰 (KEK) 加密後備份至伺服器。
- `realtime-chat-e2ee`: 整合 Socket.IO 進行即時訊息轉發。發送端自動生成對稱金鑰 AES-Key 加密訊息，並用收發雙方的 RSA 公鑰加密該 AES 金鑰，傳送給伺服器轉發。
- `security-visualizer`: 設計視覺化面板，在 UI 上動態展示訊息從「明文 -> AES 加密 -> RSA 金鑰加密 -> 傳輸密文 -> 接收端 RSA 私鑰解密金鑰 -> AES 解密密文 -> 還原明文」的完整流程，作為專題口試亮點。

### Modified Capabilities
（本專案為全新開發，無修改之舊有 Capabilities）

## Impact

- **React 前端**：新增對 `socket.io-client` 與 Web Crypto API 的依賴。
- **Flask 後端**：新增對 `flask-socketio`、`flask-jwt-extended`、`flask-sqlalchemy` 與 `cryptography` 的依賴。
- **資料庫**：新增 SQLite/PostgreSQL 資料表設計，用以儲存使用者加密金鑰與加密訊息。
