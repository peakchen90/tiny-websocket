const nickname = document.getElementById('nickname');
const content = document.getElementById('content');
const form = document.getElementById('form');
const logs = document.getElementById('logs');

nickname.value = localStorage.getItem('tiny_ws_username') || `User_${Math.random().toString(36).slice(2, 6)}`;

const ws = new WebSocket('ws://127.0.0.1:5555');

ws.onopen = () => {
  printLog('已连接服务器');
};
ws.onclose = () => {
  printLog('已断开服务器连接');
};
ws.onmessage = ({data}) => {
  const {username, data: msg} = JSON.parse(data);
  printLog(`${username}:`, msg);
};

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const data = content.value;
  const username = nickname.value;
  localStorage.setItem('tiny_ws_username', username);

  ws.send(JSON.stringify({username, data}));

  setTimeout(() => {
    content.value = '';
    content.focus();
  });
});

function printLog(head = '', msg = '') {
  const logNode = document.createElement('p');
  if (head) {
    const headNode = document.createElement('span');
    headNode.className = 'head';
    headNode.append(document.createTextNode(head));
    logNode.appendChild(headNode);
  }
  logNode.appendChild(document.createTextNode(msg));
  logs.appendChild(logNode);
}
