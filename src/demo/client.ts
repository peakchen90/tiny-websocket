import inquirer from 'inquirer';
import chalk from 'chalk';
import { mock } from 'mockjs';
import terminalImage from 'terminal-image';
import WebSocketClient from '../WebSocketClient';
import path from 'path';
import fs from 'fs-extra';

const NICK = mock('@cname');

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
  } else {
    const nickLength = message[0];
    const nick = message.slice(1, 1 + nickLength).toString();
    const imgBuffer = message.slice(1 + nickLength);

    terminalImage.buffer(imgBuffer).then((img) => {
      receive(nick);
      console.log(img);
    });
  }
});

function receive(senderNick: string, message: any = '') {
  console.log(
    `\n${chalk.bgMagenta.cyan(' Receive ')}`,
    chalk.green(senderNick),
    message
  );
}

const IMG_PATTERN = /^img>(.+)/;
const SUPPORT_EXT = ['.png', '.jpg', '.jpeg', '.gif'];

async function sender() {
  let { input } = await inquirer.prompt({
    name: 'input',
    type: 'input',
    message: '发送消息（发送图片示例: `img>./images/a.png`）',
    validate(input: any) {
      const match = input.trim().match(IMG_PATTERN);
      if (match) {
        const filename = path.resolve(match[1]);
        const ext = path.extname(filename).toLowerCase();
        if (!SUPPORT_EXT.includes(ext)) {
          return `不支持的图片格式: ${ext} (仅支持: ${SUPPORT_EXT.join(', ')})`;
        }
        if (!fs.pathExistsSync(filename)) {
          return `文件路径不存在: ${match[1]}`;
        }
      }
      return true;
    },
  });
  input = input.trim();

  if (IMG_PATTERN.test(input)) {
    const filename = path.resolve(input.slice(4));
    fs.readFile(filename).then((imgBuffer) => {
      client.send(imgBuffer, true);
    });
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
