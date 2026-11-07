import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import SecurityVisualizer from './SecurityVisualizer';
import DesktopPet from './DesktopPet';

const API_BASE_URL = 'http://127.0.0.1:5000';

export default function ChatRoom({ session, onLogout }) {
    const { token, user, privateKey } = session;
    
    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState({}); // format: { contactId: [messageObjects] }
    const [inputMessage, setInputMessage] = useState('');
    
    // 💡 閱後即焚銷毀時間狀態（秒數，預設 60 秒）
    const [destructTime, setDestructTime] = useState(60);
    
    // Security Visualizer State
    const [visualizerEnabled, setVisualizerEnabled] = useState(true);
    const [activeVisualStep, setActiveVisualStep] = useState(null);
    const [latestVisualData, setLatestVisualData] = useState(null);
    
    // Toggle state for individual message cards
    const [expandedCryptoMsgId, setExpandedCryptoMsgId] = useState(null);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Scroll to bottom helper
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 1. Fetch Users List
    useEffect(() => {
        const fetchFriends = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/friends`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setContacts(data);
                }
            } catch (err) {
                console.error("Failed to load friends", err);
            }
        };
        fetchFriends();
    }, [token]);

    // 2. Fetch Chat History when activeContact changes
    useEffect(() => {
        if (!activeContact) return;
        
        // 💡 當切換到該聊天室時，主動發送已讀標記
        if (socketRef.current) {
            socketRef.current.emit('mark_read', { sender_id: activeContact.id });
        }
        
        const fetchHistory = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/messages/${activeContact.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const dbMessages = await response.json();
                    
                    const decryptedMessages = await Promise.all(dbMessages.map(async (msg) => {
                        try {
                            const isSentByMe = msg.sender_id === user.id;
                            const encryptedKey = isSentByMe ? msg.encrypted_key_sender : msg.encrypted_key_receiver;
                            
                            const decResult = await decryptMessage(
                                msg.ciphertext,
                                msg.aes_iv,
                                encryptedKey,
                                privateKey
                            );
                            
                            return {
                                ...msg,
                                plaintext: decResult.plaintext,
                                debug: decResult.debug,
                                isDecryptionError: false
                            };
                        } catch (err) {
                            console.error("Decryption error on message", msg.id, err);
                            return {
                                ...msg,
                                plaintext: "[🔒 訊息解密失敗：無效的私鑰或金鑰損毀]",
                                isDecryptionError: true
                            };
                        }
                    }));
                    
                    setMessages(prev => ({
                        ...prev,
                        [activeContact.id]: decryptedMessages
                    }));
                }
            } catch (err) {
                console.error("Failed to load history", err);
            }
        };
        fetchHistory();
    }, [activeContact, token, user.id, privateKey]);

    // 3. Socket.IO Setup
    useEffect(() => {
        socketRef.current = io(API_BASE_URL, {
            auth: { token: token }
        });

        socketRef.current.on('connect', () => {
            console.log("Socket connected to server");
            socketRef.current.emit('join', { user_id: user.id });
        });

        socketRef.current.on('receive_message', async (msg) => {
            console.log("Socket received encrypted message", msg);
            
            if (visualizerEnabled) {
                setLatestVisualData({
                    plaintext: '...',
                    aesKeyHex: '...',
                    aesIvHex: msg.aes_iv.substring(0, 16) + '...',
                    encryptedKeyReceiverBase64: msg.encrypted_key_receiver.substring(0, 20) + '...',
                    ciphertextBase64: msg.ciphertext.substring(0, 20) + '...'
                });
                
                setActiveVisualStep(3); 
                await new Promise(r => setTimeout(r, 700));
                setActiveVisualStep(4);
                await new Promise(r => setTimeout(r, 700));
                setActiveVisualStep(5);
                await new Promise(r => setTimeout(r, 700));
            }

            try {
                const decResult = await decryptMessage(
                    msg.ciphertext,
                    msg.aes_iv,
                    msg.encrypted_key_receiver,
                    privateKey
                );

                const receiveDestructSec = 60;
                const expireAtTime = receiveDestructSec > 0 ? Date.now() + (receiveDestructSec * 1000) : null;

                const newMsg = {
                    ...msg,
                    plaintext: decResult.plaintext,
                    debug: decResult.debug,
                    isDecryptionError: false,
                    expireAt: expireAtTime,
                    duration: receiveDestructSec
                };

                if (visualizerEnabled) {
                    setLatestVisualData({
                        plaintext: decResult.plaintext,
                        aesKeyHex: decResult.debug.rawAesKeyHex,
                        aesIvHex: decResult.debug.aesIvHex,
                        encryptedKeyReceiverBase64: msg.encrypted_key_receiver,
                        ciphertextBase64: msg.ciphertext
                    });
                }

                setMessages(prev => {
                    const chatHistory = prev[msg.sender_id] || [];
                    const exists = chatHistory.some(m => 
                        (msg.id && m.id === msg.id) || 
                        (m.ciphertext === msg.ciphertext)
                    );
                    if (exists) return prev;

                    return {
                        ...prev,
                        [msg.sender_id]: [...chatHistory, newMsg]
                    };
                });

            } catch (err) {
                console.error("Failed to decrypt incoming message", err);
                const errorMsg = {
                    ...msg,
                    plaintext: "[🔒 訊息解密失敗：無效的私鑰或金鑰損毀]",
                    isDecryptionError: true
                };
                setMessages(prev => {
                    const chatHistory = prev[msg.sender_id] || [];
                    const exists = chatHistory.some(m => 
                        (msg.id && m.id === msg.id) || 
                        (m.ciphertext === msg.ciphertext)
                    );
                    if (exists) return prev;

                    return {
                        ...prev,
                        [msg.sender_id]: [...chatHistory, errorMsg]
                    };
                });
            } finally {
                setActiveVisualStep(null);
            }
        });

        socketRef.current.on('message_sent', (msg) => {
            console.log("Message saved and sync complete", msg);
        });

        // 💡 監聽對方已讀通知
        socketRef.current.on('messages_read', (data) => {
            const readerId = data.reader_id;
            setMessages(prev => {
                const contactChat = prev[readerId] || [];
                const updatedList = contactChat.map(msg => {
                    if (msg.sender_id === user.id) {
                        return { ...msg, is_read: true };
                    }
                    return msg;
                });
                return {
                    ...prev,
                    [readerId]: updatedList
                };
            });
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.emit('leave', { user_id: user.id });
                socketRef.current.disconnect();
            }
        };
    }, [privateKey, user.id, visualizerEnabled, token]);

    // 💡 閱後即焚：每秒自動掃描並移除過期訊息
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setMessages(prev => {
                let hasChanges = false;
                const updatedMessages = { ...prev };

                Object.keys(updatedMessages).forEach(contactId => {
                    const chatList = updatedMessages[contactId];
                    const validList = chatList.filter(msg => {
                        if (!msg.expireAt) return true;
                        return now < msg.expireAt;
                    });

                    if (validList.length !== chatList.length) {
                        hasChanges = true;
                        updatedMessages[contactId] = validList;
                    }
                });

                return hasChanges ? updatedMessages : prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, activeContact]);

    // 4. Send Encrypted Message Core Function
    const sendEncryptedContent = async (plaintextToSend) => {
        if (!plaintextToSend.trim() || !activeContact) return;

        try {
            if (visualizerEnabled) {
                setLatestVisualData({
                    plaintext: plaintextToSend.substring(0, 30) + '...',
                    aesKeyHex: '產生對稱加密金鑰中...',
                    aesIvHex: '產生初始化向量中...',
                    encryptedKeyReceiverBase64: '等待加密...',
                    ciphertextBase64: '等待加密...'
                });
                
                setActiveVisualStep(0);
                await new Promise(r => setTimeout(r, 600));
            }

            const encResult = await encryptMessage(
                plaintextToSend,
                activeContact.rsa_public_key,
                user.rsa_public_key
            );

            if (visualizerEnabled) {
                setLatestVisualData({
                    plaintext: plaintextToSend.substring(0, 30) + '...',
                    aesKeyHex: encResult.debug.rawAesKeyHex,
                    aesIvHex: encResult.debug.aesIvHex,
                    encryptedKeyReceiverBase64: encResult.payload.encrypted_key_receiver,
                    ciphertextBase64: encResult.payload.ciphertext
                });
                
                setActiveVisualStep(1);
                await new Promise(r => setTimeout(r, 600));
                
                setActiveVisualStep(2);
                await new Promise(r => setTimeout(r, 600));
                
                setActiveVisualStep(3);
                await new Promise(r => setTimeout(r, 400));
            }

            const socketPayload = {
                sender_id: user.id,
                receiver_id: activeContact.id,
                ciphertext: encResult.payload.ciphertext,
                aes_iv: encResult.payload.aes_iv,
                encrypted_key_sender: encResult.payload.encrypted_key_sender,
                encrypted_key_receiver: encResult.payload.encrypted_key_receiver
            };
            
            socketRef.current.emit('send_message', socketPayload);

            const expireAtTime = destructTime > 0 ? Date.now() + (destructTime * 1000) : null;

            const tempLocalMsg = {
                id: Date.now(),
                sender_id: user.id,
                receiver_id: activeContact.id,
                ciphertext: encResult.payload.ciphertext,
                aes_iv: encResult.payload.aes_iv,
                encrypted_key_sender: encResult.payload.encrypted_key_sender,
                encrypted_key_receiver: encResult.payload.encrypted_key_receiver,
                plaintext: plaintextToSend,
                debug: encResult.debug,
                timestamp: Date.now(),
                expireAt: expireAtTime,
                duration: destructTime,
                is_read: false
            };

            setMessages(prev => {
                const chatHistory = prev[activeContact.id] || [];
                return {
                    ...prev,
                    [activeContact.id]: [...chatHistory, tempLocalMsg]
                };
            });

        } catch (err) {
            console.error("Encryption and send failed", err);
        } finally {
            setActiveVisualStep(null);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;
        const text = inputMessage;
        setInputMessage('');
        await sendEncryptedContent(text);
    };

    const currentChatMessages = activeContact ? (messages[activeContact.id] || []) : [];

    return (
        <div className="glass-panel chat-app-container animated-item">
            {/* 1. Sidebar contacts */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <div className="user-profile">
                        <div className="avatar">
                            {user.username.substring(0, 2)}
                        </div>
                        <div>
                            <div className="username-tag">{user.username}</div>
                            <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                                加密連線中
                            </span>
                        </div>
                    </div>

                    <div className="visualizer-switch-container" style={{ marginTop: '6px' }}>
                        <input
                            type="checkbox"
                            className="switch-input"
                            id="visualizer-toggle"
                            checked={visualizerEnabled}
                            onChange={(e) => setVisualizerEnabled(e.target.checked)}
                        />
                        <label htmlFor="visualizer-toggle" className="switch-label">
                            視覺化面板 {visualizerEnabled ? '開' : '關'}
                        </label>
                    </div>

                    {/* 💡 訊息銷毀時間設定選單 */}
                    <div style={{ marginTop: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                        <span>🔥 訊息銷毀時間:</span>
                        <select 
                            value={destructTime} 
                            onChange={(e) => setDestructTime(Number(e.target.value))}
                            style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '2px 6px', fontSize: '12px' }}
                        >
                            <option value={0}>永不銷毀</option>
                            <option value={30}>30 秒</option>
                            <option value={60}>60 秒</option>
                            <option value={300}>300 秒</option>
                            <option value={86400}>1天</option>
                        </select>
                    </div>
                </div>

                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <input 
                        type="text" 
                        placeholder="輸入使用者名稱加好友..." 
                        id="friend-input"
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', background: '#1e293b', border: '1px solid #334155', color: '#fff' }}
                    />
                    <button 
                        className="btn-primary" 
                        style={{ width: '100%', marginTop: '6px', padding: '6px', fontSize: '12px' }}
                        onClick={async () => {
                            const username = document.getElementById('friend-input').value;
                            if (!username) return;
                            const res = await fetch(`${API_BASE_URL}/api/friends/add`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ username })
                            });
                            if (res.ok) {
                                alert('加好友成功！');
                                window.location.reload(); 
                            } else {
                                const err = await res.json();
                                alert(err.error || '加好友失敗');
                            }
                        }}
                    >
                        加好友
                    </button>
                </div>

                <div className="contact-list">
                    <p style={{ margin: '0 0 8px 12px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        聯絡人列表
                    </p>
                    {contacts.length > 0 ? (
                        contacts.map(c => (
                            <div
                                key={c.id}
                                className={`contact-item ${activeContact?.id === c.id ? 'active' : ''}`}
                                onClick={() => setActiveContact(c)}
                            >
                                <div className="avatar" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}>
                                    {c.username.substring(0, 2)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', fontSize: '15px' }}>{c.username}</div>
                                    <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                        Key: {c.rsa_public_key.substring(0, 12)}...
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p style={{ textAlign: 'center', color: '#475569', fontSize: '13px', padding: '20px' }}>
                            沒有其他可用的使用者
                        </p>
                    )}
                </div>

                <div style={{ padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <button
                        className="btn-primary"
                        onClick={onLogout}
                        style={{ width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: 'none' }}
                    >
                        登出帳號
                    </button>
                </div>
            </div>

            {/* 2. Main Chat Panel */}
            <div className="main-chat-area">
                {activeContact ? (
                    <>
                        <div className="chat-header">
                            <div className="chat-partner-info">
                                <div className="avatar" style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
                                    {activeContact.username.substring(0, 2)}
                                </div>
                                <div>
                                    <div className="chat-partner-name">{activeContact.username}</div>
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                                        端對端加密 (RSA-2048 / AES-256)
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="messages-viewport">
                            {currentChatMessages.map((msg, index) => {
                                const isSentByMe = msg.sender_id === user.id;
                                const isExpanded = expandedCryptoMsgId === msg.id;
                                
                                return (
                                    <div key={index} className={`message-row ${isSentByMe ? 'sent' : 'received'}`}>
                                       <div className="message-bubble">
                                            {msg.plaintext && msg.plaintext.startsWith('<file name=') ? (() => {
                                                const match = msg.plaintext.match(/name="([^"]+)" data="([^"]+)"/);
                                                if (match) {
                                                    const fileName = match[1];
                                                    const fileData = match[2];
                                                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

                                                    return isImage ? (
                                                        <div>
                                                            <img src={fileData} alt={fileName} style={{ maxWidth: '200px', borderRadius: '8px', display: 'block', marginBottom: '4px' }} />
                                                            <span style={{ fontSize: '11px', opacity: 0.8 }}>📷 {fileName}</span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <a href={fileData} download={fileName} style={{ color: '#93c5fd', textDecoration: 'underline', display: 'block' }}>
                                                                📎 下載檔案: {fileName}
                                                            </a>
                                                        </div>
                                                    );
                                                }
                                                return msg.plaintext;
                                            })() : (
                                                msg.plaintext
                                            )}
                                        </div>
                                        
                                        <div className="message-meta">
                                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            
                                            {/* 💡 已讀 / 送出狀態 */}
                                            {isSentByMe && (
                                                <span style={{ fontSize: '10px', color: msg.is_read ? '#10b981' : '#94a3b8', marginLeft: '6px', fontWeight: 'bold' }}>
                                                    {msg.is_read ? '✓✓ 已讀' : '✓ 送出'}
                                                </span>
                                            )}

                                            {/* 閱後即焚倒數標籤 */}
                                            {msg.expireAt && (
                                                <span style={{ fontSize: '10px', color: '#f87171', marginLeft: '6px', fontWeight: 'bold' }}>
                                                    🔥 {Math.max(0, Math.ceil((msg.expireAt - Date.now()) / 1000))}s
                                                </span>
                                            )}
                                            
                                            {visualizerEnabled && msg.debug && (
                                                <span 
                                                    style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 'bold', marginLeft: '6px' }}
                                                    onClick={() => setExpandedCryptoMsgId(isExpanded ? null : msg.id)}
                                                >
                                                    {isExpanded ? '▲ 隱藏密碼細節' : '▼ 🔐 查看密碼細節'}
                                                </span>
                                            )}
                                        </div>

                                        {isExpanded && msg.debug && (
                                            <div className="visualizer-card">
                                                <div className="visualizer-header">
                                                    🔒 E2EE 封包數值檢視
                                                </div>
                                                <div className="crypto-val-box">
                                                    <span className="crypto-title">AES 對稱金鑰 (Key Hex)</span>
                                                    <div className="crypto-value">{msg.debug.rawAesKeyHex}</div>
                                                </div>
                                                <div className="crypto-val-box">
                                                    <span className="crypto-title">初始化向量 (IV Hex)</span>
                                                    <div className="crypto-value">{msg.debug.aesIvHex}</div>
                                                </div>
                                                <div className="crypto-val-box">
                                                    <span className="crypto-title">加密後的金鑰包 (RSA Encrypted AES Key)</span>
                                                    <div className="crypto-value" style={{ fontSize: '9px' }}>
                                                        {isSentByMe ? msg.encrypted_key_sender : msg.encrypted_key_receiver}
                                                    </div>
                                                </div>
                                                <div className="crypto-val-box">
                                                    <span className="crypto-title">訊息密文 (Ciphertext Base64)</span>
                                                    <div className="crypto-value" style={{ fontSize: '9px' }}>{msg.ciphertext}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="chat-input-area" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                                type="file" 
                                id="file-input" 
                                style={{ display: 'none' }} 
                                onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file || !activeContact) return;

                                    if (file.size > 2 * 1024 * 1024) {
                                        alert('檔案大小不能超過 2MB');
                                        return;
                                    }

                                    const reader = new FileReader();
                                    reader.onload = async () => {
                                        const fileBase64 = reader.result;
                                        const fileTag = `<file name="${file.name}" data="${fileBase64}">`;
                                        await sendEncryptedContent(fileTag);
                                    };
                                    reader.readAsDataURL(file);
                                }}
                            />

                            <button 
                                type="button" 
                                onClick={() => document.getElementById('file-input').click()}
                                style={{ background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '20px' }}
                                title="上傳圖片或檔案"
                            >
                                📎
                            </button>

                            <input
                                type="text"
                                className="chat-input-field"
                                placeholder={`向 ${activeContact.username} 發送端對端加密安全訊息...`}
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                disabled={activeVisualStep !== null}
                                style={{ flex: 1 }}
                            />
                            <button
                                type="submit"
                                className="btn-send"
                                disabled={activeVisualStep !== null || !inputMessage.trim()}
                            >
                                Send
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>💬</div>
                        <h3>請選擇聯絡人開始進行端對端安全通訊</h3>
                        <p style={{ fontSize: '13px' }}>所有聊天內容皆在瀏覽器端使用 AES 加密後送出，伺服器無法查看明文。</p>
                    </div>
                )}
            </div>

            {/* 3. Right Visualizer Pane */}
            {visualizerEnabled && (
                <SecurityVisualizer
                    activeStep={activeVisualStep}
                    visualData={latestVisualData}
                />
            )}

            {/* 💡 4. 加入桌寵元件 */}
            <DesktopPet securityStatus={activeVisualStep !== null ? 'decrypt_error' : 'secure'} />
        </div>
    );
}