import http from 'http';
import WebSocketServer from './WebSocketServer';

const server = http.createServer();
const wss = new WebSocketServer(server);

wss.on('message', (sender, message) => {
  const {username, data} = JSON.parse(message);

  sender.broadcast(JSON.stringify({
    username: username || 'Anonymous',
    data
  }));
});

server.listen(5555);
