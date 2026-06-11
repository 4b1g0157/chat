## 1. 後端資料庫結構重構 (Backend Database Refactoring)

- [ ] 1.1 在 `server/models.py` 中新增 `Group` 與 `GroupMember` 資料表，並修改 `Message` 使 `receiver_id` 與 `group_id` 可為 Null
- [ ] 1.2 在 `server/models.py` 中定義關聯表 `MessageKey` (`message_id`, `user_id`, `encrypted_key`) 儲存一對多金鑰，並移除 `Message` 原本的 `encrypted_key_sender` 與 `encrypted_key_receiver` 欄位
- [ ] 1.3 在 `server/app.py` 啟動時加入清除與重建資料庫邏輯 (`db.drop_all()` 與 `db.create_all()`) 以防舊資料不相容

## 2. 後端群組管理 API 與歷史訊息 (Backend Group REST API & History)

- [ ] 2.1 實作 `/api/groups` 建立群組端點 (POST)，儲存群組名稱與成員關聯
- [ ] 2.2 實作 `/api/groups` 查詢所屬群組端點 (GET)，返回使用者加入的所有群組列表
- [ ] 2.3 實作 `/api/groups/<int:group_id>/members` 查詢群組成員端點 (GET)，以利發送端查詢群組成員的 RSA 公鑰
- [ ] 2.4 重構 `/api/messages/<int:other_user_id>` (私聊歷史) 並新增 `/api/messages/group/<int:group_id>` (群聊歷史)，在查詢歷史時，需關聯查詢目前使用者所屬的金鑰 (`MessageKey`)

## 3. 後端 Socket.IO 群聊廣播 (Backend Socket.IO Group Routing)

- [ ] 3.1 實作 Socket.IO `join_group` 事件，讓登入後的使用者自動加入所屬群組的 Socket 房間 (`group_<group_id>`)
- [ ] 3.2 實作 Socket.IO `send_group_message` 事件，將群組密文寫入資料庫，並將傳入的多個金鑰寫入 `MessageKey`，最後廣播轉發至群組房間

## 4. 前端一對多密碼學處理 (Frontend Multi-Key Cryptography)

- [ ] 4.1 在 `client/src/utils/crypto.js` 實作群組加密與解密函數，支援將對稱金鑰以多個成員的 RSA 公鑰加密，並回傳金鑰字典對照表

## 5. 前端群聊 UI 與視覺化面板 (Frontend Group UI & Visualizer)

- [ ] 5.1 實作「建立群組聊天」按鈕與 Modal，可輸入群組名稱並勾選多個聯絡人建立加密群組
- [ ] 5.2 在側邊欄新增「加密群組列表」區塊，點選群組可切換至群組聊天室
- [ ] 5.3 整合群聊發送邏輯：取得成員公鑰 -> 執行一對多加密 -> 透過 Socket 發送群組訊息封包
- [ ] 5.4 整合群聊接收與歷史紀錄解密邏輯，從金鑰字典中取出屬於自己的金鑰包進行解密並渲染
- [ ] 5.5 修改安全視覺化面板，在發送與接收群組訊息時展示一對多加密過程與所有群組成員的金鑰封包
