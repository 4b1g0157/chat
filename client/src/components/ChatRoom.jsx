import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import SecurityVisualizer from './SecurityVisualizer';

export default function ChatRoom({ session, onLogout }) {
    const { token, user, privateKey } = session;
    
    const [contacts, setContacts] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [messages, setMessages] = useState({}); // format: { contactId: [messageObjects] }
    const [inputMessage, setInputMessage] = useState('');
    
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
        const fetchUsers = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/users', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setContacts(data);
                }
            } catch (err) {
                console.error("Failed to load contacts", err);
            }
        };
        fetchUsers();
    }, [token]);

    // 2. Fetch Chat History when activeContact changes
    useEffect(() => {
        if (!activeContact) return;
        
        const fetchHistory = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/messages/${activeContact.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const dbMessages = await response.json();
                    
                    // Decrypt each message from database
                    const decryptedMessages = await Promise.all(dbMessages.map(async (msg) => {
                        try {
                            // Determine which encrypted key to use (receiver's key if received, sender's key if sent)
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
        // Connect to Flask-SocketIO Server
        socketRef.current = io('http://localhost:5000');

        socketRef.current.on('connect', () => {
            console.log("Socket connected to server");
            // Join User's Private Room
            socketRef.current.emit('join', { user_id: user.id });
        });

        // Handle incoming encrypted messages
        socketRef.current.on('receive_message', async (msg) => {
            console.log("Socket received encrypted message", msg);
            
            // Start Visualizer Sequence for incoming message
            if (visualizerEnabled) {
                setLatestVisualData({
                    plaintext: '...',
                    aesKeyHex: '...',
                    aesIvHex: msg.aes_iv.substring(0, 16) + '...',
                    encryptedKeyReceiverBase64: msg.encrypted_key_receiver.substring(0, 20) + '...',
                    ciphertextBase64: msg.ciphertext.substring(0, 20) + '...'
                });
                
                // Step 4: Receive Encrypted Socket Packet
                setActiveVisualStep(3); 
                await new Promise(r => setTimeout(r, 700));
                
                // Step 5: RSA Decrypt Symmetric AES Key
                setActiveVisualStep(4);
                await new Promise(r => setTimeout(r, 700));
                
                // Step 6: AES Decrypt Ciphertext to Plaintext
                setActiveVisualStep(5);
                await new Promise(r => setTimeout(r, 700));
            }

            try {
                // Decrypt message
                const decResult = await decryptMessage(
                    msg.ciphertext,
                    msg.aes_iv,
                    msg.encrypted_key_receiver,
                    privateKey
                );

                const newMsg = {
                    ...msg,
                    plaintext: decResult.plaintext,
                    debug: decResult.debug,
                    isDecryptionError: false
                };

                // Add to visualizer inspector
                if (visualizerEnabled) {
                    setLatestVisualData({
                        plaintext: decResult.plaintext,
                        aesKeyHex: decResult.debug.rawAesKeyHex,
                        aesIvHex: decResult.debug.aesIvHex,
                        encryptedKeyReceiverBase64: msg.encrypted_key_receiver,
                        ciphertextBase64: msg.ciphertext
                    });
                }

                // Add to message state
                setMessages(prev => {
                    const chatHistory = prev[msg.sender_id] || [];
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
                    return {
                        ...prev,
                        [msg.sender_id]: [...chatHistory, errorMsg]
                    };
                });
            } finally {
                setActiveVisualStep(null);
            }
        });

        // Handle sender-side validation echo (sync sent messages)
        socketRef.current.on('message_sent', (msg) => {
            console.log("Message saved and sync complete", msg);
            // Already decrypted locally when sending, so we don't re-decrypt.
            // Just ensure it is added to the state history if it doesn't exist
            setMessages(prev => {
                const chatHistory = prev[msg.receiver_id] || [];
                const exists = chatHistory.some(m => m.id === msg.id);
                if (exists) return prev;
                
                // Find matching temporary message and update its ID
                return {
                    ...prev,
                    [msg.receiver_id]: [...chatHistory, {
                        ...msg,
                        plaintext: inputMessage // Fallback fallback plaintext
                    }]
                };
            });
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.emit('leave', { user_id: user.id });
                socketRef.current.disconnect();
            }
        };
    }, [privateKey, user.id, visualizerEnabled]);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages, activeContact]);

    // 4. Send Encrypted Message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || !activeContact) return;

        const plaintextToSend = inputMessage;
        setInputMessage('');

        try {
            // Start Visualizer Sequence for sending message
            if (visualizerEnabled) {
                setLatestVisualData({
                    plaintext: plaintextToSend,
                    aesKeyHex: '產生對稱加密金鑰中...',
                    aesIvHex: '產生初始化向量中...',
                    encryptedKeyReceiverBase64: '等待加密...',
                    ciphertextBase64: '等待加密...'
                });
                
                // Step 1: Generate AES Key and IV
                setActiveVisualStep(0);
                await new Promise(r => setTimeout(r, 600));
            }

            // Step 2: Encrypt message via hybrid RSA-OAEP + AES-GCM-256
            const encResult = await encryptMessage(
                plaintextToSend,
                activeContact.rsa_public_key,
                user.rsa_public_key
            );

            if (visualizerEnabled) {
                setLatestVisualData({
                    plaintext: plaintextToSend,
                    aesKeyHex: encResult.debug.rawAesKeyHex,
                    aesIvHex: encResult.debug.aesIvHex,
                    encryptedKeyReceiverBase64: encResult.payload.encrypted_key_receiver,
                    ciphertextBase64: encResult.payload.ciphertext
                });
                
                // Step 2: RSA encrypt symmetric key
                setActiveVisualStep(1);
                await new Promise(r => setTimeout(r, 600));
                
                // Step 3: AES encrypt message body
                setActiveVisualStep(2);
                await new Promise(r => setTimeout(r, 600));
                
                // Step 4: Send package via socket
                setActiveVisualStep(3);
                await new Promise(r => setTimeout(r, 400));
            }

            // Emit E2EE payload to Socket.IO Server
            const socketPayload = {
                sender_id: user.id,
                receiver_id: activeContact.id,
                ciphertext: encResult.payload.ciphertext,
                aes_iv: encResult.payload.aes_iv,
                encrypted_key_sender: encResult.payload.encrypted_key_sender,
                encrypted_key_receiver: encResult.payload.encrypted_key_receiver
            };
            
            socketRef.current.emit('send_message', socketPayload);

            // Construct local message item to instantly render
            const tempLocalMsg = {
                id: Date.now(), // temporary client-side ID
                sender_id: user.id,
                receiver_id: activeContact.id,
                ciphertext: encResult.payload.ciphertext,
                aes_iv: encResult.payload.aes_iv,
                encrypted_key_sender: encResult.payload.encrypted_key_sender,
                encrypted_key_receiver: encResult.payload.encrypted_key_receiver,
                plaintext: plaintextToSend,
                debug: encResult.debug,
                timestamp: new Date().toISOString()
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
                                            {msg.plaintext}
                                        </div>
                                        
                                        <div className="message-meta">
                                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            
                                            {visualizerEnabled && msg.debug && (
                                                <span 
                                                    style={{ color: '#818cf8', cursor: 'pointer', fontWeight: 'bold' }}
                                                    onClick={() => setExpandedCryptoMsgId(isExpanded ? null : msg.id)}
                                                >
                                                    {isExpanded ? '▲ 隱藏密碼細節' : '▼ 🔐 查看密碼細節'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Expandable Crypto Inspector per message */}
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

                        <form onSubmit={handleSendMessage} className="chat-input-area">
                            <input
                                type="text"
                                className="chat-input-field"
                                placeholder={`向 ${activeContact.username} 發送端對端加密安全訊息...`}
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                disabled={activeVisualStep !== null}
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
        </div>
    );
}
