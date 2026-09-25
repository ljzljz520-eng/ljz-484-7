// store.js —— 文件存储层
// 不使用数据库，整份故事序列化为一个 JSON 文件保存。
// 写入采用「临时文件 + rename」的原子写策略，避免并发写坏数据。
const fs = require('node:fs/promises');
const path = require('node:path');
const { createEmptyStory } = require('./model');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'story.json');

/** 串行化所有写操作，保证多个请求同时保存时不会互相覆盖 */
let writeChain = Promise.resolve();

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/** 读取故事；文件不存在时返回一份空故事（不落盘，首次保存时创建） */
async function loadStory() {
  await ensureDataDir();
  let raw;
  try {
    raw = await fs.readFile(DATA_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return createEmptyStory();
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`故事数据文件解析失败（${DATA_FILE}）：${err.message}`);
  }
}

/** 覆盖保存整个故事对象，写入操作按调用顺序排队执行 */
function saveStory(story) {
  const task = writeChain.then(async () => {
    await ensureDataDir();
    const tmp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(story, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE);
  });
  // 让单次写失败不会永久阻塞后续写
  writeChain = task.catch(() => {});
  return task;
}

module.exports = { loadStory, saveStory, DATA_FILE };
