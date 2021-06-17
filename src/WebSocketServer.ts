import EventEmitter from 'events';
import * as http from 'http';
import * as stream from 'stream';
import {Buffer} from 'buffer';
import {STATUS_CODES} from 'http';
import {createHash} from 'crypto';
import WebSocket from './WebSocket';

export default class WebSocketServer extends EventEmitter {
  server: http.Server;
  sockets: Map<stream.Duplex, WebSocket>

  constructor(server: http.Server) {
    super();
    this.server = server;
    this.sockets = new Map();

    // listen server events
    this.server.on('listening', this.emit.bind(this, 'listening'));
    this.server.on('error', this.emit.bind(this, 'error'));
    this.server.on('upgrade', this.handleUpgrade.bind(this));
  }

  handleUpgrade(req: http.IncomingMessage, socket: stream.Duplex) {
    const key = req.headers['sec-websocket-key']?.trim() || '';
    const version = Number(req.headers['sec-websocket-version']);

    if (
      req.headers.upgrade?.toLowerCase() !== 'websocket' ||
      req.method !== 'GET' ||
      (version !== 13)
    ) {
      this.abortHandShake(socket, 400);
    }

    // Destroy the socket if the client has already sent a FIN packet.
    if (!socket.readable || !socket.writable) {
      socket.destroy();
      return;
    }

    const chunks = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${this.hash(key)}`,
      '\r\n'
    ];
    socket.write(chunks.join('\r\n'));
    const ws = new WebSocket(this, socket);
    this.sockets.set(socket, ws);
    this.emit('connection', ws);
  }

  on(event: 'connection', listener: (ws: WebSocket) => void): this;
  on(event: 'disconnect', listener: () => void): this;
  on(event: 'ping', listener: (ws: WebSocket) => void): this;
  on(event: 'pong', listener: (ws: WebSocket) => void): this;
  on(event: 'message', listener: (message: any, sender: WebSocket) => void): this;
  on(event: 'close', listener: (message: any, sender: WebSocket) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  send(message: any, socket?: stream.Duplex) {
    if (socket) {
      const target = this.sockets.get(socket);
      target?.send(message);
    } else {
      this.sockets.forEach(ws => {
        ws.send(message);
      });
    }
  }

  close() {
    this.sockets.forEach(ws => {
      ws.close();
    });
  }

  hash(value: string): string {
    const MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    return createHash('sha1').update(value + MAGIC_GUID).digest('base64');
  }

  abortHandShake(socket: stream.Duplex, code: number, message?: string, headers?: Record<string, any>) {
    if (socket.writable) {
      message = message || STATUS_CODES[code];
      headers = {
        Connection: 'close',
        'Content-Type': 'text/html',
        'Content-Length': Buffer.byteLength(message!),
        ...headers
      };

      let chunk = `HTTP/1.1 ${code} ${STATUS_CODES[code]}\r\n`;
      chunk += Object.keys(headers).map(key => `${key}: ${headers![key]}`).join('\r\n');
      chunk += `\r\n\r\n${message}`;

      socket.write(chunk);
    }

    socket.destroy();
  }
}
