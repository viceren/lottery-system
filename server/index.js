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
  origin: "*"
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const DEFAULT_TOTAL_LOTS = 20;
const MIN_TOTAL_LOTS = 7;
// 抽到"主"则排除（转移给剩余空签，自身变"空"）
const DEFAULT_EXCLUDE_ZHU_USERS = ["汪桥","黄俊宏"];
// 抽到任何非空签(正/反/主)都排除（转移给剩余空签，自身变"空"）
const DEFAULT_EXCLUDE_NON_EMPTY_USERS = ["李兵"];

let gameState = {
  isStarted: false,
  totalLots: DEFAULT_TOTAL_LOTS,
  excludeZhuUsers: DEFAULT_EXCLUDE_ZHU_USERS,
  excludeNonEmptyUsers: DEFAULT_EXCLUDE_NON_EMPTY_USERS,
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

function createLotTypes(totalLots) {
  const emptyLots = Math.max(0, totalLots - 7);
  return [
    ...Array(3).fill('正'),
    ...Array(3).fill('反'),
    ...Array(1).fill('主'),
    ...Array(emptyLots).fill('空')
  ];
}

function normalizeTotalLots(input) {
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed)) return DEFAULT_TOTAL_LOTS;
  return Math.max(MIN_TOTAL_LOTS, parsed);
}

function initGame(totalLots = DEFAULT_TOTAL_LOTS, excludeZhuUsers = DEFAULT_EXCLUDE_ZHU_USERS, excludeNonEmptyUsers = DEFAULT_EXCLUDE_NON_EMPTY_USERS) {
  const normalizedLots = normalizeTotalLots(totalLots);
  const shuffledContents = shuffle(createLotTypes(normalizedLots));
  
  gameState.lots = shuffledContents.map((content, index) => ({
    id: index,
    content: content,
    pickedBy: null,
    isRevealed: false
  }));
  gameState.isStarted = true;
  gameState.totalLots = normalizedLots;
  gameState.excludeZhuUsers = Array.isArray(excludeZhuUsers) ? excludeZhuUsers : [];
  gameState.excludeNonEmptyUsers = Array.isArray(excludeNonEmptyUsers) ? excludeNonEmptyUsers : [];
  gameState.pickHistory = [];
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Send current state to new connection
  socket.emit('gameStateUpdate', gameState);

  socket.on('startGame', (payload) => {
    const username = typeof payload === 'string' ? payload : payload?.username;
    const totalLots = typeof payload === 'string' ? DEFAULT_TOTAL_LOTS : payload?.totalLots;

    if (username === 'admin') {
      initGame(totalLots, DEFAULT_EXCLUDE_ZHU_USERS, DEFAULT_EXCLUDE_NON_EMPTY_USERS);
      io.emit('gameStateUpdate', gameState);
      console.log(`Game started by admin, total lots: ${gameState.totalLots}, exclude zhu users: ${gameState.excludeZhuUsers.length}, exclude non-empty users: ${gameState.excludeNonEmptyUsers.length}`);
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
      
      // 排除规则：
      //  - excludeZhuUsers:      抽到"主"则排除
      //  - excludeNonEmptyUsers: 抽到任何非空签(正/反/主)则排除
      // 命中时把该签内容随机转移给一个剩余未开封的空签，当前签变"空"，
      // 既满足排除要求又不损耗全场非空签总数，消除后抽者的概率惩罚。
      const isZhuExcluded = gameState.excludeZhuUsers.includes(username) && lot.content === '主';
      const isNonEmptyExcluded = (gameState.excludeNonEmptyUsers || []).includes(username) && lot.content !== '空';
      if (isZhuExcluded || isNonEmptyExcluded) {
        const remainingEmptyLots = gameState.lots.filter(l => !l.pickedBy && l.id !== lot.id && l.content === '空');
        if (remainingEmptyLots.length > 0) {
          const targetIndex = Math.floor(Math.random() * remainingEmptyLots.length);
          remainingEmptyLots[targetIndex].content = lot.content; // 转移原内容(主/正/反)
        }
        lot.content = '空';
      }
      
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
