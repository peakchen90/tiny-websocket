# tiny-websocket
基于 node 实现一个微小版 WebSocket

## 运行 demo
```bash
# 安装依赖
yarn install

# 编译
yarn build

# 运行demo
yarn demo

# 然后用浏览器打开 `demo/index.html` 文件 (HTTP协议方式)
```

## Features
- 只实现了基本功能，不要用于生产环境！
- 目前只支持接收/发送文本，不支持二进制

## 参考
- https://datatracker.ietf.org/doc/html/rfc6455#section-5
- https://github.com/websockets/ws
- https://developer.mozilla.org/zh-CN/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
- https://juejin.cn/post/6844903544978407431
