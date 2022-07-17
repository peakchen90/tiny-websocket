import { Buffer } from 'buffer';
import stream from 'stream';
import { randomFillSync } from 'crypto';
import EventEmitter from 'events';
import KeepAlive from './KeepAlive';

export type MessageType = any | Buffer;

export type WebSocketType = 'server' | 'client';

/*
 Frame:
 - https://datatracker.ietf.org/doc/html/rfc6455#section-5.2
 - https://developer.mozilla.org/zh-CN/docs/Web/API/WebSockets_API/Writing_WebSocket_servers

      0                   1                   2                   3
      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     +-+-+-+-+-------+-+-------------+-------------------------------+
     |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
     |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
     |N|V|V|V|       |S|             |   (if payload len==126/127)   |
     | |1|2|3|       |K|             |                               |
     +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
     |     Extended payload length continued, if payload len == 127  |
     + - - - - - - - - - - - - - - - +-------------------------------+
     |                               |Masking-key, if MASK set to 1  |
     +-------------------------------+-------------------------------+
     | Masking-key (continued)       |          Payload Data         |
     +-------------------------------- - - - - - - - - - - - - - - - +
     :                     Payload Data continued ...                :
     + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
     |                     Payload Data continued ...                |
     +---------------------------------------------------------------+

 操作码 (opcode)
   -  %x0 denotes a continuation frame
   -  %x1 denotes a text frame
   -  %x2 denotes a binary frame
   -  %x3-7 are reserved for further non-control frames
   -  %x8 denotes a connection close
   -  %x9 denotes a ping
   -  %xA denotes a pong
   -  %xB-F are reserved for further control frames

*/

const MASKING_BUFFER = Buffer.alloc(4);

export default class WebSocket {
  host: EventEmitter;
  type: WebSocketType;
  closed: boolean;
  socket: stream.Duplex;

  private isContinueReceiveData: boolean;
  private bufferedBytes: number; // 所有缓存 buffer 的字节数
  private buffers: Buffer[]; // 所有缓存的buffer
  private fragments: Buffer[]; // 保存分片内容

  private fin: boolean; // 分片是否结束（true表示结束）
  private opcode: number; // 操作码
  private masked: boolean; // 是否使用掩码
  private maskingKey?: Buffer; // 掩码key
  private payloadLength: number; // 当前帧数据载荷长度
  private totalPayloadLength: number; // 数据载荷总长度

  private keepAlive: KeepAlive;

  constructor(
    host: EventEmitter,
    socket: stream.Duplex,
    type: WebSocketType,
    keepAlive = false
  ) {
    this.host = host;
    this.type = type;
    this.closed = false;
    this.socket = socket;

    this.isContinueReceiveData = false;
    this.bufferedBytes = 0;
    this.buffers = [];
    this.fragments = [];

    this.fin = false;
    this.opcode = 0;
    this.masked = false;
    this.payloadLength = 0;

    this.totalPayloadLength = 0;

    this.init();

    this.keepAlive = new KeepAlive(this);
    if (keepAlive) {
      this.keepAlive.start();
    }
  }

  init() {
    this.socket.on('data', (chunk) => {
      this.append(chunk);
    });
  }

  /**
   * @param chunk
   */
  append(chunk: any) {
    // 已断开
    if (this.opcode === 0x08) {
      return;
    }

    this.bufferedBytes += chunk.length;
    this.buffers.push(chunk);

    if (!this.isContinueReceiveData) {
      this.receiveHeader();
    }
    this.receiveData();
  }

  receiveHeader() {
    if (this.bufferedBytes < 2) {
      return;
    }

    // Buffer 继承 Uint8Array 类
    // @see https://nodejs.org/api/buffer.html#buffer
    const buffer = this.consume(2);

    // Tips: 一个字节有8位； `&` 运算符，只有2个位都为1时，才会1，否则为0
    this.fin = (buffer[0] & 0b10000000) === 0b10000000; // 取第1位，判断为0还是1
    const opcode = buffer[0] & 0b00001111; // 取第4-8位
    this.opcode = opcode === 0x00 ? this.opcode : opcode; // 0x00 表示当时是片段延续，使用之前的 opcode
    this.masked = (buffer[1] & 0b10000000) === 0b10000000; // 取第9位，判断为0还是1（Mask）

    // https://developer.mozilla.org/zh-CN/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#%E8%A7%A3%E7%A0%81%E6%9C%89%E6%95%88%E8%BD%BD%E8%8D%B7%E9%95%BF%E5%BA%A6
    this.payloadLength = buffer[1] & 0b01111111; // 取第10-16位（Payload len）
    if (this.payloadLength === 126) {
      // 通过大端序方式（高位在前，低位在后）读取16位无符号整数
      this.payloadLength = this.consume(2).readUInt16BE(0);
    } else if (this.payloadLength === 127) {
      const target = this.consume(8);
      let num = target.readUInt32BE(0) * Math.pow(2, 32); // 读取前4个字节， 并强制左移32位（为后面32位腾空间）
      this.payloadLength = num + target.readUInt32BE(4);
    }
    this.totalPayloadLength += this.payloadLength; // 记录分片传输场景的收到总字节数

    // 读取掩码（32位）
    if (this.masked) {
      this.maskingKey = this.consume(4);
    }
  }

  receiveData() {
    let data = Buffer.alloc(0);
    if (this.payloadLength > 0) {
      // 等待缓冲区分段读取完成
      if (this.bufferedBytes < this.payloadLength) {
        this.isContinueReceiveData = true;
        return;
      } else {
        this.isContinueReceiveData = false;
      }

      data = this.consume(this.payloadLength);
      if (this.masked) {
        this.mask(data, this.maskingKey!);
      }
    }

    // control frames
    if (this.opcode >= 0x08) {
      this.handleControlFrames(data);
      this.totalPayloadLength = 0;
      this.fragments = [];
      return;
    }

    this.fragments.push(data);

    // 分片传输结束
    if (this.fin) {
      let message = this.concatBuffer(this.fragments);
      if (this.opcode === 0x02) {
        // 二进制数据
        this.host.emit('message', this, message);
      } else {
        // 文本数据
        this.host.emit('message', this, message.toString());
      }

      this.totalPayloadLength = 0;
      this.fragments = [];
    }
  }

  concatBuffer(buffers: Buffer[]): Buffer {
    let res = Buffer.alloc(0);
    if (buffers.length > 1) {
      res = Buffer.allocUnsafe(this.totalPayloadLength);
      let offset = 0;
      this.fragments.forEach((item) => {
        res.set(item, offset);
        offset += item.length;
      });
    } else if (buffers.length === 1) {
      res = buffers[0];
    }
    return res;
  }

  /**
   * 处理控制帧
   * @see https://datatracker.ietf.org/doc/html/rfc6455#section-5.5
   */
  handleControlFrames(data: Buffer) {
    // disconnect
    if (this.opcode === 0x08) {
      const code = data.slice(0, 2).readUInt16BE(0);
      const reason = data.slice(2).toString();

      this.close(code, reason);
      return;
    }

    const message = data.toString();

    if (this.opcode === 0x09) {
      // ping
      this.host.emit('ping', this, message);
      this.pong(message);
    } else if (this.opcode === 0x0a) {
      // pong
      this.host.emit('pong', this, message);
    }
  }

  /**
   * 加密/解密 掩码
   * @see https://datatracker.ietf.org/doc/html/rfc6455#section-5.3
   * @param data
   * @param maskingKey
   */
  mask(data: Buffer, maskingKey: Buffer) {
    for (let i = 0; i < data.length; i++) {
      data[i] = data[i] ^ maskingKey[i % 4];
    }
  }

  /**
   * 从缓存的 buffer 中消费 n 个字节，返回消费的字节数据
   * @param n
   */
  consume(n: number): Buffer {
    this.bufferedBytes -= n;
    const EMPTY_BUFFER = Buffer.alloc(0);
    const firstBuffer = this.buffers[0];

    if (!firstBuffer) {
      return EMPTY_BUFFER;
    }

    if (firstBuffer.length === n) {
      return this.buffers.shift() || EMPTY_BUFFER;
    }

    if (firstBuffer.length > n) {
      this.buffers[0] = firstBuffer.slice(n);
      return firstBuffer.slice(0, n);
    }

    const buffer = Buffer.allocUnsafe(n);
    while (n > 0) {
      const current = this.buffers[0];
      let offset = buffer.length - n;
      if (n >= current.length) {
        buffer.set(this.buffers.shift() || EMPTY_BUFFER, offset);
      } else {
        buffer.set(current.slice(0, n), offset);
        this.buffers[0] = current.slice(n);
      }

      n -= current.length;
    }

    return buffer;
  }

  /**
   * 组装 ws 帧数据
   * @param data
   * @param masked
   * @param opcode
   * @param fin
   */
  buildFrame(data: Buffer, { masked = false, opcode = 0, fin = false } = {}) {
    const length = data.length;
    let payloadLength = length;
    let offset = 2; // 保留头部信息字节数
    if (masked) {
      offset += 4;
    }

    if (length > 0b11111111_11111111) {
      // 长度大于`16位最大整数`，使用64位无符号整数
      payloadLength = 127;
      offset += 8;
    } else if (length > 125) {
      // 长度大于125, 使用16位无符号整数
      payloadLength = 126;
      offset += 2;
    }

    const buffer = Buffer.allocUnsafe(offset + length);

    // 写入第一个8位
    buffer[0] = (fin ? 0b10000000 : 0b00000000) | opcode;
    // 写入第二个8位
    buffer[1] = (masked ? 0b10000000 : 0b00000000) | payloadLength;

    if (payloadLength === 126) {
      buffer.writeUInt16BE(length, 2);
    } else if (payloadLength === 127) {
      buffer.writeUInt32BE(0, 2); // 前面32位填充0 (受字符串长度限制，只需留后 32 位存长度就够了)
      buffer.writeUInt32BE(length, 2 + 4); // 后32位写入 payloadLength 数据
    }

    // 写入 maskingKey
    if (masked) {
      // http://nodejs.cn/api/crypto.html#crypto_crypto_randomfillsync_buffer_offset_size
      randomFillSync(MASKING_BUFFER, 0, 4); // 用随机数填充 MASKING_BUFFER buffer
      buffer[offset - 4] = MASKING_BUFFER[0];
      buffer[offset - 3] = MASKING_BUFFER[1];
      buffer[offset - 2] = MASKING_BUFFER[2];
      buffer[offset - 1] = MASKING_BUFFER[3];
      data = data.slice(0);
      this.mask(data, MASKING_BUFFER);
      buffer.set(data, offset);
    } else {
      buffer.set(data, offset);
    }

    return buffer;
  }

  close(code = 1001, reason = 'Unknown Reason') {
    if (!this.closed) {
      this.closed = true;
      this.keepAlive.destroy();
      this.host.emit('disconnect', this, code, reason);
      this.socket.destroy();
    }
  }

  send(message: MessageType | MessageType[], isBinary = false) {
    if (!Array.isArray(message)) {
      message = [message];
    }

    let opcode = isBinary ? 0x02 : 0x01;
    let isFragments = message.length > 1;
    for (let i = 0; i < message.length; i++) {
      let item = message[i];
      if (!isBinary) {
        item = String(item);
      }

      this.sendFrame(Buffer.isBuffer(item) ? item : Buffer.from(item), {
        opcode: isFragments && i > 0 ? 0x00 : opcode,
        fin: i === message.length - 1,
      });
    }
  }

  sendFrame(buffer: Buffer, { opcode, fin }: { opcode: number; fin: boolean }) {
    this.socket.write(
      this.buildFrame(buffer, {
        // https://datatracker.ietf.org/doc/html/rfc6455#section-5.1
        // 服务端发送不能使用掩码
        masked: this.type !== 'server',
        opcode,
        fin,
      })
    );
  }

  ping(message = '') {
    this.sendFrame(Buffer.from(message), {
      opcode: 0x09,
      fin: true,
    });
  }

  pong(message = '') {
    this.sendFrame(Buffer.from(message), {
      opcode: 0x0a,
      fin: true,
    });
  }
}
