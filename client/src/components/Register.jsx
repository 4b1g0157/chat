import React, { useState } from 'react';
import { generateRsaKeyPair, exportPublicKey, encryptPrivateKey } from '../utils/crypto';

export default function Register({ onSwitchToLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username || !password || !passphrase) {
            setError('Please fill in all fields.');
            setLoading(false);
            return;
        }

        if (passphrase.length < 6) {
            setError('Security passphrase must be at least 6 characters.');
            setLoading(false);
            return;
        }

        try {
            // Step 1: Generate RSA Key Pair (2048-bit RSA-OAEP)
            const keys = await generateRsaKeyPair();
            
            // Step 2: Export RSA Public Key to Base64 format
            const pubKeyBase64 = await exportPublicKey(keys.publicKey);
            
            // Step 3: Encrypt RSA Private Key using AES-GCM-256 with KEK derived from passphrase
            const encryptedPrivKeyJson = await encryptPrivateKey(keys.privateKey, passphrase);
            
            // Step 4: Send payload to Flask registration API
            const response = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password, // Backend will hash it using Werkzeug Security
                    rsa_public_key: pubKeyBase64,
                    encrypted_rsa_private_key: encryptedPrivKeyJson
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed.');
            }

            setSuccess(true);
            setTimeout(() => {
                onSwitchToLogin();
            }, 2000);

        } catch (err) {
            console.error(err);
            setError(err.message || 'An error occurred during registration.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel auth-container animated-item">
            <h2 className="auth-title">E2EE Chat System</h2>
            <p style={{ textAlign: 'center', margin: '-10px 0 10px 0', color: '#94a3b8', fontSize: '14px' }}>
                端對端加密即時聊天 ─ 註冊帳號
            </p>

            {error && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '14px' }}>
                    {error}
                </div>
            )}

            {success && (
                <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '14px' }}>
                    註冊成功！即將轉向登入頁面...
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                    <label className="form-label">使用者帳號</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="請輸入帳號"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading || success}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">登入密碼</label>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="請輸入密碼"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading || success}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">金鑰安全密碼 (Passphrase)</label>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="用來在瀏覽器解密您的私鑰"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        disabled={loading || success}
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        此密碼不會上傳至伺服器。請務必記住它以解密未來的聊天訊息。
                    </span>
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    style={{ marginTop: '8px' }}
                    disabled={loading || success}
                >
                    {loading ? '產生密鑰並註冊中...' : '註冊帳號 (生成金鑰)'}
                </button>
            </form>

            <div className="auth-footer">
                已經有帳號了嗎？ 
                <a href="#" className="auth-link" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }}>
                    立即登入
                </a>
            </div>
        </div>
    );
}
