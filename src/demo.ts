import http from 'http';
import WebSocketServer from './WebSocketServer';
import {Duplex} from 'stream';

const server = http.createServer();
const wss = new WebSocketServer(server);

let uid = 0;

wss.on('message', (sender, message) => {
  if (typeof message === 'string') {
    const {type, data} = JSON.parse(message);
    if (type === 'join') {
      sender['nickname'] = (data || `Anonymous(${++uid})`).slice(0, 255);
      sender.broadcast(message);
    } else if (type === 'message') {
      sender.broadcast(JSON.stringify({
        type: 'message',
        username: sender['nickname'],
        data
      }));
    }
  } else {
    // 0 0 0 0 0 0 0 0 : 昵称长度
    // ...             : 昵称位置
    // ...             : 二进制数据位置
    const nickname: string = sender['nickname'];
    const nicknameBuffer = Buffer.allocUnsafe(1 + nickname.length);
    nicknameBuffer.writeUInt8(nickname.length, 0);
    nicknameBuffer.set(Buffer.from(nickname), 1);

    sender.broadcast([nicknameBuffer, message], true);
  }
});

wss.on('disconnect', (sender) => {
  sender.broadcast(JSON.stringify({
    type: 'leave',
    data: sender['nickname']
  }));
});

server.listen(5555);
