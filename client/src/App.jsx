import React, { useState } from 'react'
import Login from './components/Login'
import Register from './components/Register'
import ChatRoom from './components/ChatRoom'

function App() {
  const [screen, setScreen] = useState('login') // 'login', 'register', 'chatroom'
  const [session, setSession] = useState(null)   // { token, user, privateKey }

  const handleLoginSuccess = (loginSession) => {
    setSession(loginSession)
    setScreen('chatroom')
  }

  const handleLogout = () => {
    setSession(null)
    setScreen('login')
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
