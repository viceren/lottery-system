import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { User, LogOut, Play, RefreshCw } from 'lucide-react';

const getBackendUrl = () => {
  const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  // 如果环境变量里只有域名（比如 draw-lots-backend.onrender.com），自动补全 https://
  if (url.includes('onrender.com') && !url.startsWith('http')) {
    return `https://${url}`;
  }
  return url;
};

const socket = io(getBackendUrl(), {
  transports: ['websocket', 'polling'], // 强制启用协议
  autoConnect: true
});

function App() {
  const [isConnected, setIsConnected] = useState(false); // 新增连接状态
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [gameState, setGameState] = useState({
    isStarted: false,
    lots: [],
    pickHistory: []
  });
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected!');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected!');
    });

    // Check for username in URL
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    if (userParam) {
      setUsername(userParam);
      setIsLoggedIn(true);
    }

    socket.on('gameStateUpdate', (newState) => {
      setGameState(newState);
    });

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('gameStateUpdate');
      socket.off('error');
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setIsLoggedIn(true);
    }
  };

  const handleStartGame = () => {
    socket.emit('startGame', username);
  };

  const handlePickLot = (id) => {
    if (!gameState.isStarted) return;
    const lot = gameState.lots.find(l => l.id === id);
    if (lot && !lot.pickedBy) {
      socket.emit('pickLot', { id, username });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
  };

  if (!isLoggedIn) {
    return (
      <div className="card">
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>抽签系统登录</h2>
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            placeholder="请输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary">进入系统</button>
        </form>
      </div>
    );
  }

  const allPicked = gameState.lots.length > 0 && gameState.lots.every(l => l.pickedBy !== null);
  const canStart = username === 'admin' && (!gameState.isStarted || allPicked);

  return (
    <div className="card">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={20} />
          <span style={{ fontWeight: 'bold' }}>{username}</span>
          {username === 'admin' && <span style={{ fontSize: '0.8rem', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px' }}>管理员</span>}
          <span style={{ 
            fontSize: '0.7rem', 
            background: isConnected ? '#dcfce7' : '#fee2e2', 
            color: isConnected ? '#166534' : '#991b1b', 
            padding: '2px 6px', 
            borderRadius: '4px',
            marginLeft: '10px'
          }}>
            {isConnected ? '● 已连接' : '○ 连接中...'}
          </span>
        </div>
        <button onClick={handleLogout} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666' }}>
          <LogOut size={18} /> 退出
        </button>
      </header>

      <main>
        {username === 'admin' && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <button 
              onClick={handleStartGame} 
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}
              disabled={!canStart}
            >
              {gameState.isStarted && !allPicked ? <RefreshCw size={18} /> : <Play size={18} />}
              {gameState.isStarted && !allPicked ? '重新开始 (需等待全员抽完)' : '开始新一局抽签'}
            </button>
          </div>
        )}

        {!gameState.isStarted ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            {username === 'admin' ? '点击上方按钮开始新一局抽签' : '等待管理员开始抽签...'}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>抽签区域 (共19签)</h3>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                已抽: {gameState.lots.filter(l => l.pickedBy).length} / 19
              </div>
            </div>

            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

            <div className="lot-grid">
              {gameState.lots.map((lot) => (
                <div
                  key={lot.id}
                  className={`lot ${lot.pickedBy ? 'picked' : ''}`}
                  onClick={() => handlePickLot(lot.id)}
                >
                  {lot.pickedBy ? (
                    <>
                      <div className="username">{lot.pickedBy}</div>
                      <div className="content">{lot.content}</div>
                    </>
                  ) : (
                    <div style={{ color: '#9ca3af' }}>?</div>
                  )}
                </div>
              ))}
            </div>

            {allPicked && (
              <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>本局已完成！最终抽签结果：</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginTop: '1rem' }}>
                  {gameState.lots.map(l => (
                    <div key={l.id} style={{ fontSize: '0.85rem', padding: '0.4rem', borderBottom: '1px solid #eee' }}>
                      <strong>{l.pickedBy}:</strong> {l.content}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
