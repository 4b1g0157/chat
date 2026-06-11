## 1. 後端基礎建設與資料庫設定 (Backend Foundation & Database Setup)

- [x] 1.1 初始化 Flask API 專案目錄結構與安裝相依套件 (`Flask`, `Flask-SocketIO`, `Flask-JWT-Extended`, `Flask-SQLAlchemy`, `cryptography`)
- [x] 1.2 設定 SQLite 資料庫並使用 SQLAlchemy 定義 `User` 與 `Message` 資料表
- [x] 1.3 實作使用者註冊端點 (`/api/register`)，接收 `username`、`password_hash`、`rsa_public_key`、`encrypted_rsa_private_key` 並寫入資料庫
- [x] 1.4 實作使用者登入端點 (`/api/login`)，驗證密碼並回傳 JWT 以及該使用者的加密私鑰
- [x] 1.5 實作查詢特定使用者公鑰端點 (`/api/users/<username>/public-key`)，需具備 JWT 驗證保護

## 2. 前端基礎建設與登入介面 (Frontend Foundation & Auth UI)

- [x] 2.1 使用 Vite 建立 React 前端專案，並安裝 `socket.io-client`
- [x] 2.2 實作基礎 UI 版面，包含註冊頁面、登入頁面與聊天大廳
- [x] 2.3 實作登入與註冊的 API 對接，登入後將 JWT 存於 React 全局 State 中

## 3. 前端密碼學模組 (Client-Side Cryptography)

- [x] 3.1 使用 Web Crypto API 實作非對稱金鑰生成函數，產生 2048-bit RSA-OAEP 金鑰對
- [x] 3.2 實作 PBKDF2 密碼衍生函數，使用使用者的 Passphrase 衍生出 256-bit AES 金鑰 (KEK)
- [x] 3.3 實作私鑰加密函數 (AES-GCM-256)，在註冊時加密 RSA 私鑰，並連同公鑰上傳至伺服器
- [x] 3.4 實作私鑰解密函數，在登入時要求使用者輸入 Passphrase 解密私鑰，並暫存於 React 記憶體 (State) 中
- [x] 3.5 實作前端金鑰獲取模組，在發送訊息前向後端請求收件者的 RSA 公鑰

## 4. Socket.IO 即時訊息傳遞與加解密整合 (Real-time Messaging & Encryption)

- [x] 4.1 在 Flask 後端整合 Socket.IO，實作連線管理與 Private Room 加入邏輯（每位使用者加入以自己 ID 命名的房間）
- [x] 4.2 在 React 前端建立 Socket.IO 連線，並在登入後自動連線與加入對應房間
- [x] 4.3 實作發送端加密邏輯：生成隨機 AES 金鑰與 IV -> AES-GCM 加密訊息 -> 用收發雙方 RSA 公鑰分別加密 AES 金鑰 -> 透過 Socket 發送密文套件
- [x] 4.4 實作後端 Socket 接收處理：儲存密文與加密金鑰包至 `Message` 資料表，並將套件轉發給收件者房間
- [x] 4.5 實作接收端解密邏輯：收到密文套件 -> 用 in-memory 私鑰解密出對稱金鑰 -> 解密訊息密文並渲染於對話框

## 5. 安全視覺化面板與展示優化 (Security Visualizer & UI Polish)

- [x] 5.1 設計「安全調試模式 (Security Visualizer)」全域開關與狀態管理
- [x] 5.2 實作聊天室訊息旁的可展開「加密金鑰與密文檢視面板」，以十六進位格式展示 AES 金鑰、IV、RSA 加密後金鑰、以及密文 (Ciphertext)
- [x] 5.3 實作發送與接收訊息時的「金鑰交換與加解密流程圖動畫」，在畫面上動態引導教授理解端對端加密的每個環節
