import EventEmitter from 'events';
import net from 'net';
import httpHeaders from 'http-headers';
import { createHash } from 'crypto';
import WebSocket, { MessageType } from './WebSocket';
import { Buffer } from 'buffer';

export default class WebSocketClient extends EventEmitter {
  url: URL;
  socket: net.Socket;
  closed: boolean;
  connecting: boolean;
  connected: boolean;
  ws?: WebSocket;

  constructor(url: string) {
    super();

    this.closed = false;
    this.connecting = true;
    this.connected = false;

    this.url = new URL(url);
    this.socket = new net.Socket({ writable: true, readable: true }).connect({
      port: Number(this.url.port || 80),
      host: this.url.hostname,
    });

    this.initialize();
  }

  private initialize() {
    const MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    const randomKey = `WebSocket@${Math.random().toFixed(10)}`;
    const key = Buffer.from(randomKey).toString('base64');
    const hashKey = createHash('sha1')
      .update(key + MAGIC_GUID)
      .digest('base64');

    const chunks = [
      `GET ${this.url.href} HTTP/1.1`,
      `Host ${this.url.host}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      '\r\n',
    ];
    this.socket.write(chunks.join('\r\n'));

    this.socket.on('data', (chunk) => {
      if (this.connecting) {
        const { statusCode, headers } = httpHeaders(chunk.toString());

        if (
          statusCode === 101 &&
          headers.upgrade?.toLowerCase() === 'websocket' &&
          headers.connection?.toLowerCase() === 'upgrade' &&
          headers['sec-websocket-accept'] === hashKey
        ) {
          this.connecting = false;
          this.connected = true;
          this.ws = new WebSocket(this, this.socket, 'client', false);
          this.emit('connection', this.ws!);
        } else {
          this.close(new Error('Handshake Aborted'));
        }
      }
    });
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
    listener: (ws: WebSocket, message: string | Buffer) => void
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

  send(message: MessageType | MessageType[], isBinary = false) {
    this.ws?.send(message, isBinary);
  }

  close(reason?: Error) {
    this.socket.destroy(reason);
    this.closed = true;
    this.connected = false;
    this.connecting = false;
  }
}
