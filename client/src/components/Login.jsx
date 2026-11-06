import React, { useState } from 'react';
import { decryptPrivateKey, exportPrivateKeyToJwk } from '../utils/crypto';

export default function Login({ onLoginSuccess, onSwitchToRegister }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username || !password || !passphrase) {
            setError('Please fill in all fields.');
            setLoading(false);
            return;
        }

        try {
            // Step 1: Authenticate with Flask API
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Login failed.');
            }

            const { access_token, user, encrypted_rsa_private_key } = data;

            // Step 2: Decrypt RSA Private Key locally in browser memory
            let decryptedPrivateKeyObj;
            try {
                decryptedPrivateKeyObj = await decryptPrivateKey(encrypted_rsa_private_key, passphrase);
            } catch (decryptionErr) {
                console.error(decryptionErr);
                throw new Error('金鑰解密失敗：安全密碼（Passphrase）錯誤，無法還原私鑰！');
            }

            // 💡 Step 3: Export CryptoKey to JWK format for localStorage persistence
            const privateKeyJwk = await exportPrivateKeyToJwk(decryptedPrivateKeyObj);

            // Step 4: Callback with authenticated session, decrypted private key & its JWK form
            onLoginSuccess({
                token: access_token,
                user: user,
                privateKey: decryptedPrivateKeyObj,
                privateKeyJwk: privateKeyJwk
            });

        } catch (err) {
            console.error(err);
            setError(err.message || 'An error occurred during login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel auth-container animated-item">
            <h2 className="auth-title">E2EE Chat System</h2>
            <p style={{ textAlign: 'center', margin: '-10px 0 10px 0', color: '#94a3b8', fontSize: '14px' }}>
                端對端加密即時聊天 ─ 帳號登入
            </p>

            {error && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '14px' }}>
                    {error}
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
                        disabled={loading}
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
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">金鑰安全密碼 (Passphrase)</label>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="請輸入註冊時的金鑰安全密碼"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        disabled={loading}
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        輸入此密碼以在本地解密您的 RSA 私鑰。伺服器並不知道此密碼。
                    </span>
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    style={{ marginTop: '8px' }}
                    disabled={loading}
                >
                    {loading ? '身分驗證與金鑰解密中...' : '登入並解密私鑰'}
                </button>
            </form>

            <div className="auth-footer">
                還沒有帳號嗎？ 
                <a href="#" className="auth-link" onClick={(e) => { e.preventDefault(); onSwitchToRegister(); }}>
                    立即註冊
                </a>
            </div>
        </div>
    );
}