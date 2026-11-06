import React, { useState, useEffect } from 'react'
import Login from './components/Login'
import Register from './components/Register'
import ChatRoom from './components/ChatRoom'
import { exportPrivateKeyToJwk, importPrivateKeyFromJwk } from './utils/crypto'

function App() {
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState('login'); // 'login', 'register', 'chatroom'
  const [loading, setLoading] = useState(true); // 用於非同步還原私鑰時的等待狀態

  // 💡 在網頁載入時，從 localStorage 非同步還原登入狀態與 CryptoKey
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = localStorage.getItem('chat_token');
        const savedUser = localStorage.getItem('chat_user');
        const savedPrivateKeyJwk = localStorage.getItem('chat_private_key_jwk');

        if (savedToken && savedUser && savedPrivateKeyJwk) {
          // 將儲存的 JWK 字串還原為瀏覽器可用的 CryptoKey 物件
          const jwkObj = JSON.parse(savedPrivateKeyJwk);
          const privateKeyObj = await importPrivateKeyFromJwk(jwkObj);

          setSession({
            token: savedToken,
            user: JSON.parse(savedUser),
            privateKey: privateKeyObj
          });
          setScreen('chatroom');
        }
      } catch (e) {
        console.error("Failed to restore session, clearing storage", e);
        handleLogout(); // 若還原失敗（例如金鑰損毀），自動清除快取
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const handleLoginSuccess = async (loginSession) => {
    // loginSession 包含 { token, user, privateKey (CryptoKey) }
    setSession(loginSession);
    setScreen('chatroom');
    
    try {
      // 💡 將 CryptoKey 匯出為 JWK 格式後再存入 localStorage
      const privateKeyJwk = await exportPrivateKeyToJwk(loginSession.privateKey);
      
      localStorage.setItem('chat_token', loginSession.token);
      localStorage.setItem('chat_user', JSON.stringify(loginSession.user));
      localStorage.setItem('chat_private_key_jwk', JSON.stringify(privateKeyJwk));
    } catch (e) {
      console.error("Failed to save session to localStorage", e);
    }
  }

  const handleLogout = () => {
    setSession(null);
    setScreen('login');
    
    // 💡 登出時清空所有持久化快取
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_private_key_jwk');
  }

  // 正在非同步還原金鑰時顯示的載入畫面
  if (loading) {
    return (
      <div style={{ display: 'flex', width: '100vw', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#fff', background: '#0f172a' }}>
        <h3>安全工作階段載入中...</h3>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
      {screen === 'login' && (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onSwitchToRegister={() => setScreen('register')}
        />
      )}

      {screen === 'register' && (
        <Register
          onSwitchToLogin={() => setScreen('login')}
        />
      )}

      {screen === 'chatroom' && session && (
        <ChatRoom
          session={session}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}

export default App