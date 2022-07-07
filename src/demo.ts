import http from 'http';
import WebSocketServer from './WebSocketServer';
import path from 'path';
import fs from 'fs-extra';
import mime from 'mime-types';

const server = http.createServer();
const wss = new WebSocketServer(server);

const PUBLIC_ROOT = path.join(__dirname, '../public');
const PORT = 3333;

let uid = 0;

wss.on('message', (sender, message) => {
  if (typeof message === 'string') {
    const { type, data } = JSON.parse(message);
    if (type === 'join') {
      sender['nickname'] = (data || `Anonymous(${++uid})`).slice(0, 255);
      wss.broadcast(message);
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
    const nickname: string = sender['nickname'];
    const nicknameBuffer = Buffer.allocUnsafe(1 + nickname.length);
    nicknameBuffer.writeUInt8(nickname.length, 0);
    nicknameBuffer.set(Buffer.from(nickname), 1);

    wss.broadcast([nicknameBuffer, message], true);
  }
});

wss.on('disconnect', (sender) => {
  wss.broadcast(
    JSON.stringify({
      type: 'leave',
      data: sender['nickname'],
    })
  );
});

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

  const filename = path.join(PUBLIC_ROOT, url);
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
