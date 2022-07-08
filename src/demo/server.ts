import http from 'http';
import path from 'path';
import fs from 'fs-extra';
import mime from 'mime-types';
import WebSocketServer from '../WebSocketServer';

const server = http.createServer();
const wss = new WebSocketServer(server);

const ROOT = path.join(__dirname, '../..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PORT = 3333;

let uid = 0;

wss.on('message', (sender, message) => {
  if (typeof message === 'string') {
    const { type, data } = JSON.parse(message);
    if (type === 'join') {
      sender['nickname'] = (data || `Anonymous(${++uid})`).slice(0, 255);
      wss.broadcast(message);
      printOnlineUsers();
    } else if (type === 'message') {
      wss.broadcast(
        JSON.stringify({
          type: 'message',
          username: sender['nickname'],
          data,
        })
      );
    }
  } else {
    // 0 0 0 0 0 0 0 0 : 昵称长度
    // ...             : 昵称位置
    // ...             : 二进制数据位置
    const nickBuffer = Buffer.from(sender['nickname']);
    const headerBuffer = Buffer.allocUnsafe(1 + nickBuffer.length);
    headerBuffer.writeUInt8(nickBuffer.length, 0);
    headerBuffer.set(nickBuffer, 1);

    wss.broadcast([headerBuffer, message], true);
  }
});

wss.on('disconnect', (sender) => {
  wss.broadcast(
    JSON.stringify({
      type: 'leave',
      data: sender['nickname'],
    })
  );
  printOnlineUsers();
});

function printOnlineUsers() {
  const users = [...wss.sockets.values()].map((item) => item['nickname']);
  console.log('Online User:', users);
}

// public static assets
server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
  let url = req.url;
  const searchIndex = url?.indexOf('?');
  if (searchIndex != null && searchIndex >= 0) {
    url = url?.slice(0, searchIndex);
  }
  if (!url || url === '/') {
    url = '/index.html';
  }

  const filename = url.startsWith('/node_modules/')
    ? path.join(ROOT, url)
    : path.join(PUBLIC_ROOT, url);

  if (fs.pathExistsSync(filename)) {
    res.statusCode = 200;
    res.setHeader('Content-Type', mime.lookup(filename) || 'text/plain');
    res.setHeader('Cache-Control', 'max-age=0');
    res.write(fs.readFileSync(filename));
    res.end();
  } else {
    res.statusCode = 404;
    res.statusMessage = 'Not Found';
    res.end('404 Not Found');
  }
});

server.on('listening', () => {
  console.log(`服务启动成功: http://127.0.0.1:${PORT}`);
});

server.listen(PORT);
