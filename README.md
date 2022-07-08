# tiny-websocket

基于 node 实现一个微小版 WebSocket

## 运行 demo


**启动服务**
```bash
yarn demo:server
```

> 然后在浏览器中打开 `http://127.0.0.1:3333`

**运行 WebSocket 客户端（nodejs）**
```bash
yarn demo:client
```

> Tips: WebSocket 客户端 (nodejs) 可以与浏览器客户端互相交互通信，基于 ws 协议

## Features

- 只实现了基本功能，不要用于生产环境！
- 支持文本/二进制传输
- 支持 ping/pong
- 支持分片传输
- *不支持压缩*

## 参考

- https://datatracker.ietf.org/doc/html/rfc6455#section-5
- https://github.com/websockets/ws
- https://developer.mozilla.org/zh-CN/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
- https://juejin.cn/post/6844903544978407431
