// 게임 .js 파일을 브라우저 없이(node vm) 불러와 게임 로직만 꺼내는 도우미
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function loadGame(file, name) {
  const ctx = { Math, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'games', file), 'utf8'), ctx);
  return ctx[name];
};
