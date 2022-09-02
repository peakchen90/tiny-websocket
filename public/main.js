const nickname = document.getElementById('nickname');
const content = document.getElementById('content');
const form = document.getElementById('form');
const image = document.getElementById('image');
const logs = document.getElementById('logs');

const nick = localStorage.getItem('tiny_ws_username') || Mock.mock('@cname');
const decoder = new TextDecoder('utf-8');

nickname.innerText = nick;
localStorage.setItem('tiny_ws_username', nick);

const ws = new WebSocket('ws://127.0.0.1:3333');
ws.binaryType = 'arraybuffer';

window.ws = ws;

ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: 'join',
      data: nick,
    })
  );
};

ws.onclose = () => {
  printLog('服务器连接已断开');
};

ws.onmessage = (evt) => {
  if (typeof evt.data === 'string') {
    const { type, username, data } = JSON.parse(evt.data);
    switch (type) {
      case 'join':
        printLog(`${data} 已加入`);
        break;
      case 'leave':
        printLog(`${data} 已离开`);
        break;
      case 'message':
        printLog(`${username}:`, data);
        break;
      default:
    }
  } else {
    const buffer = new Uint8Array(evt.data);
    const _nickLength = buffer[0];
    const _nick = decoder.decode(buffer.slice(1, 1 + _nickLength));
    const _imageObj = new Blob([buffer.slice(1 + _nickLength).buffer]);

    const msgNode = document.createElement('p');
    const imgNode = document.createElement('img');
    imgNode.src = URL.createObjectURL(_imageObj);
    imgNode.style.maxWidth = '60%';
    imgNode.style.maxHeight = '300px';
    imgNode.style.marginLeft = '10px';
    imgNode.style.marginBottom = '10px';
    msgNode.appendChild(imgNode);

    printLog(`${_nick}:`, msgNode);
  }
};

form.onsubmit = (e) => {
  e.preventDefault();

  const data = content.value;
  ws.send(
    JSON.stringify({
      type: 'message',
      data,
    })
  );

  setTimeout(() => {
    content.value = '';
    content.focus();
  });
};

image.onchange = ({ target }) => {
  const [file] = target.files;

  if (file) {
    ws.send(file);
  }

  setTimeout(() => {
    image.value = '';
  });
};

function printLog(head = '', msg = '') {
  const logNode = document.createElement('p');
  if (head) {
    const headNode = document.createElement('span');
    headNode.className = 'head';
    headNode.append(document.createTextNode(head));
    logNode.appendChild(headNode);
  }
  logNode.appendChild(
    msg instanceof HTMLElement ? msg : document.createTextNode(msg)
  );
  logs.appendChild(logNode);

  setTimeout(() => {
    logs.scrollTo(0, logs.scrollHeight);
  });
}
