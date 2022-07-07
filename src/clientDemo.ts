import inquirer from 'inquirer';
import chalk from 'chalk';
import WebSocketClient from './WebSocketClient';

const NICK = `Client_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const client = new WebSocketClient('ws://127.0.0.1:3333');

client.socket.on('error', (err) => {
  console.error(err);
});

client.on('connection', (ws) => {
  console.log(`Welcome, ${NICK}`);
  ws.send(
    JSON.stringify({
      type: 'join',
      data: NICK,
    })
  );
  sender();
});

client.on('message', (ws, message) => {
  if (typeof message === 'string') {
    const { type, username, data } = JSON.parse(message);
    switch (type) {
      case 'join':
        receive(`${data} 已加入`);
        break;
      case 'leave':
        receive(`${data} 已离开`);
        break;
      case 'message':
        receive(`${username}:`, data);
        break;
      default:
    }
  }
});

function receive(senderNick: string, message: any = '') {
  console.log(
    `\n${chalk.bgMagenta.cyan(' Receive ')}`,
    chalk.green(senderNick),
    message
  );
}

async function sender() {
  let { input } = await inquirer.prompt({
    name: 'input',
    type: 'input',
    message: '发送消息（发送图片指令: `pic:[图片路径]`）',
  });
  input = input.trim();

  if (/^pic:.+/.test(input)) {
    // TODO
  } else {
    client.send(
      JSON.stringify({
        type: 'message',
        data: input,
      })
    );
  }

  return sender();
}
