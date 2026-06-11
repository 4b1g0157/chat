## Why

為了讓此畢業專題的系統架構更加完整、更接近實用級的通訊軟體，本變更計畫在原有的 1-on-1 加密聊天的基礎上，新增「端對端加密群組聊天 (E2EE Group Chat)」功能。

## What Changes

我們將修改並擴充現有系統以支援群組加密聊天：
- **修改** 資料庫 Schema：新增 `Group` 與 `GroupMember` 資料表，並將 Message 的金鑰儲存重構為關聯表 `MessageKey`（一對多），用以支援一條訊息加密給多個群組成員。
- **新增** 後端 API：新增建立群組 (`/api/groups` POST)、查詢使用者所屬群組 (`/api/groups` GET) 與查詢群組歷史訊息 API。
- **修改** Socket.IO 邏輯：新增加入群組房間 (`join_group`) 與群組加密訊息轉發機制。
- **修改** 前端 React UI：新增「建立群組」對話框，在聯絡人列表旁新增「群組列表」，並在聊天視窗中支援群組聊天。
- **修改** 安全視覺化面板：支援展示一對多的 RSA 金鑰加密流程（展示發送端如何將同一個對稱金鑰加密成多個成員的 RSA 密文）。

## Capabilities

### New Capabilities
- `e2ee-group-chat`: 支援建立加密群組、查詢群組成員公鑰、發送群組 E2EE 訊息。發送端下載群組所有成員的公鑰，將同一對稱金鑰加密多份，並透過 Socket 轉發與廣播給群組成員。

### Modified Capabilities
（本變更無修改舊有已歸檔之 Capabilities，皆是在現有架構上進行演進）

## Impact

- **Database**: `messages` 資料表結構重構，移除單一對收發金鑰欄位，改用關聯表 `message_keys` 儲存多個金鑰。
- **Backend API & Socket**: 新增群組相關端點與 Socket.IO room 廣播。
- **React Frontend**: `ChatRoom.jsx` 需要增加群組切換與多金鑰加密邏輯，`SecurityVisualizer.jsx` 需展示多金鑰加密流程。
