import EventEmitter from 'events';
import http from 'http';
import stream from 'stream';
import { Buffer } from 'buffer';
import { createHash } from 'crypto';
import WebSocket, { MessageType } from './WebSocket';

export default class WebSocketServer extends EventEmitter {
  server: http.Server;
  sockets: Map<stream.Duplex, WebSocket>;

  constructor(server: http.Server) {
    super();

    this.server = server;
    this.sockets = new Map();

    // listen server events
    this.server.on('listening', this.emit.bind(this, 'listening'));
    this.server.on('error', this.emit.bind(this, 'error'));
    this.server.on('upgrade', this.handleUpgrade.bind(this));

    this.on('disconnect', (ws) => {
      this.sockets.delete(ws.socket);
    });
  }

  private handleUpgrade(req: http.IncomingMessage, socket: stream.Duplex) {
    const key = req.headers['sec-websocket-key']?.trim() || '';
    const version = Number(req.headers['sec-websocket-version']);

    if (
      req.headers.upgrade?.toLowerCase() !== 'websocket' ||
      req.method !== 'GET' ||
      version !== 13
    ) {
      this.abortHandShake(socket, 400);
    }

    // Destroy the socket if the client has already sent a FIN packet.
    if (!socket.readable || !socket.writable) {
      socket.destroy();
      return;
    }

    const MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    const hashKey = createHash('sha1')
      .update(key + MAGIC_GUID)
      .digest('base64');

    const handshake = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${hashKey}`,
      '\r\n',
    ];
    socket.write(handshake.join('\r\n'));
    const ws = new WebSocket(this, socket, 'server');
    this.sockets.set(socket, ws);
    this.emit('connection', ws);

    let isClosed = false;
    const handleCloseSocket = () => {
      if (!isClosed) {
        isClosed = true;
        ws.close();
      }
    };
    socket.on('error', () => handleCloseSocket());
    socket.on('close', () => handleCloseSocket());
    socket.on('end', () => handleCloseSocket());
  }

  private abortHandShake(
    socket: stream.Duplex,
    code: number,
    message?: string,
    headers?: Record<string, any>
  ) {
    if (socket.writable) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: 'close',
        'Content-Type': 'text/html',
        'Content-Length': Buffer.byteLength(message!),
        ...headers,
      };

      let chunk = `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n`;
      chunk += Object.keys(headers)
        .map((key) => `${key}: ${headers![key]}`)
        .join('\r\n');
      chunk += `\r\n\r\n${message}`;

      socket.write(chunk);
    }

    socket.destroy();
  }

  on(event: 'connection', listener: (ws: WebSocket) => void): this;
  on(
    event: 'disconnect',
    listener: (ws: WebSocket, code: number, reason: string) => void
  ): this;
  on(event: 'ping', listener: (ws: WebSocket, message: string) => void): this;
  on(event: 'pong', listener: (ws: WebSocket, message: string) => void): this;
  on(
    event: 'message',
    listener: (sender: WebSocket, message: string | Buffer) => void
  ): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  off(event: 'connection', listener: (ws: WebSocket) => void): this;
  off(
    event: 'disconnect',
    listener: (ws: WebSocket, code: number, reason: string) => void
  ): this;
  off(event: 'ping', listener: (ws: WebSocket, message: string) => void): this;
  off(event: 'pong', listener: (ws: WebSocket, message: string) => void): this;
  off(
    event: 'message',
    listener: (sender: WebSocket, message: string | Buffer) => void
  ): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  broadcast(message: MessageType | MessageType[], isBinary = false) {
    this.sockets.forEach((ws) => {
      ws.send(message, isBinary);
    });
  }

  close() {
    this.sockets.forEach((ws) => {
      ws.close();
    });
  }
}
