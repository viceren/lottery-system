const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

const getAllowedOrigins = () => {
  const origin = process.env.CLIENT_URL || "http://localhost:3000";
  // 如果环境变量里只有域名，允许域名本身以及带 https 的域名
  if (origin.includes('onrender.com') && !origin.startsWith('http')) {
    return [origin, `https://${origin}`];
  }
  return origin;
};

const ALLOWED_ORIGIN = getAllowedOrigins();

app.use(cors({
  origin: ALLOWED_ORIGIN
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 暂时放开，确保连接成功
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'] // 强制支持两种模式
});

const TOTAL_LOTS = 19;
const LOT_TYPES = [
  ...Array(3).fill('正'),
  ...Array(3).fill('反'),
  ...Array(1).fill('主'),
  ...Array(12).fill('空')
];

let gameState = {
  isStarted: false,
  lots: [], // { id, content, pickedBy, isRevealed }
  pickHistory: [] // To keep track of who picked what in order
};

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

function initGame() {
  const shuffledContents = shuffle([...LOT_TYPES]);
  gameState.lots = shuffledContents.map((content, index) => ({
    id: index,
    content: content,
    pickedBy: null,
    isRevealed: false
  }));
  gameState.isStarted = true;
  gameState.pickHistory = [];
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Send current state to new connection
  socket.emit('gameStateUpdate', gameState);

  socket.on('startGame', (username) => {
    if (username === 'admin') {
      const allPicked = gameState.lots.length === 0 || gameState.lots.every(l => l.pickedBy !== null);
      if (!gameState.isStarted || allPicked) {
        initGame();
        io.emit('gameStateUpdate', gameState);
        console.log('Game started by admin');
      } else {
        socket.emit('error', '本轮抽签尚未结束！');
      }
    }
  });

  socket.on('pickLot', ({ id, username }) => {
    if (!gameState.isStarted) return;
    
    const lot = gameState.lots.find(l => l.id === id);
    if (lot && !lot.pickedBy) {
      // Check if user already picked in this round
      const alreadyPicked = gameState.lots.some(l => l.pickedBy === username);
      if (alreadyPicked && username !== 'admin') {
        socket.emit('error', '你已经抽过签了！');
        return;
      }

      lot.pickedBy = username;
      lot.isRevealed = true;
      gameState.pickHistory.push({ username, content: lot.content });

      io.emit('gameStateUpdate', gameState);
      console.log(`${username} picked lot ${id}: ${lot.content}`);

      // Check if all lots are picked
      const allPicked = gameState.lots.every(l => l.pickedBy !== null);
      if (allPicked) {
        console.log('Round finished');
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
