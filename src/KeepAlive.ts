import WebSocket from './WebSocket';

export default class KeepAlive {
  ws: WebSocket;

  private currentIndex: number;
  private tryCount: number;
  private timer?: NodeJS.Timeout;
  private _listener: any;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.currentIndex = 0;
    this.tryCount = 0;

    this.ws.host.on(
      'pong',
      (this._listener = (_ws, message) => {
        if (this.ws === _ws) {
          const responseIndex = Number(message);
          if (this.currentIndex === responseIndex) {
            this.tryCount = 0;
            this.start();
          }
        }
      })
    );
  }

  start(retry: boolean = false) {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.ws.ping(String(retry ? this.currentIndex : ++this.currentIndex));

      if (++this.tryCount <= 3) {
        this.start(retry);
      } else {
        this.ws.close();
        this.destroy();
      }
    }, 3000);

    return this;
  }

  destroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.ws.host.off('pong', this._listener);
  }
}
