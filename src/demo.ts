import http from 'http';
import WebSocketServer from './WebSocketServer';

const server = http.createServer();
const ws = new WebSocketServer(server);

ws.on('message', (message, sender) => {
  const {username, data} = JSON.parse(message);

  sender.broadcast(JSON.stringify({
    username: username || 'Anonymous',
    data
  }));
});

server.listen(5555);
