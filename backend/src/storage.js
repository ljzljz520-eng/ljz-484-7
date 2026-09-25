// JSON 文件存储层：无数据库，所有故事保存在 data/stories.json
// 写入采用“临时文件 + rename”的原子方式，避免写到一半文件损坏。
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'stories.json');

export const newId = () => randomUUID();

// 内置示例故事，首次启动且数据文件为空时写入
const SAMPLE = {
  id: 'sample-story',
  title: '迷雾客栈',
  description: '一个演示用的互动故事：你的选择决定结局。',
  startNodeId: 'n1',
  nodes: [
    {
      id: 'n1',
      type: 'story',
      title: '雨夜投宿',
      body: '暴雨倾盆，你推开山间客栈的木门。掌柜擦着杯子，抬头看了你一眼：「楼上最后一间房，不过……夜里无论听见什么，都别开门。」',
      choices: [
        { id: 'c1', text: '接过钥匙上楼', targetNodeId: 'n2' },
        { id: 'c2', text: '反问掌柜为何不能开门', targetNodeId: 'n3' }
      ]
    },
    {
      id: 'n2',
      type: 'story',
      title: '午夜叩门',
      body: '三更天，门外响起指甲刮过木板的声音，一个沙哑的声音唤着你的名字。',
      choices: [
        { id: 'c3', text: '蒙住头，一动不动', targetNodeId: 'n4' },
        { id: 'c4', text: '壮起胆子开门查看', targetNodeId: 'n5' }
      ]
    },
    {
      id: 'n3',
      type: 'story',
      title: '掌柜的警告',
      body: '掌柜压低声音：「十年前有位客人夜里开了门，第二天人不见了，只剩一身湿衣服。」他塞给你一张黄色符纸。',
      choices: [
        { id: 'c5', text: '收好符纸，上楼休息', targetNodeId: 'n4' }
      ]
    },
    {
      id: 'n4',
      type: 'ending',
      title: '结局：等到天明',
      body: '你攥着符纸（或者被子）熬到鸡叫。阳光照进房间，门外只有一滩水渍。你活着走出了客栈。',
      choices: []
    },
    {
      id: 'n5',
      type: 'ending',
      title: '结局：门后的东西',
      body: '门轴吱呀转动，湿冷的手攥住了你的脚踝。第二天，柜台上多了一件叠好的湿衣服。',
      choices: []
    }
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

let cache = null;

function load() {
  if (cache) return cache;
  if (!existsSync(DATA_FILE)) {
    cache = [SAMPLE];
    persist(cache);
    return cache;
  }
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    cache = Array.isArray(parsed.stories) ? parsed.stories : [];
  } catch {
    // 文件损坏时不要崩溃，备份后从空开始
    if (existsSync(DATA_FILE)) {
      renameSync(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`);
    }
    cache = [];
  }
  return cache;
}

function persist(stories) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify({ stories }, null, 2), 'utf-8');
  renameSync(tmp, DATA_FILE);
}

export function listStories() {
  return load().map(({ nodes, ...meta }) => ({
    ...meta,
    nodeCount: nodes.length,
    endingCount: nodes.filter((n) => n.type === 'ending').length
  }));
}

export function getStory(id) {
  return load().find((s) => s.id === id) ?? null;
}

export function createStory(input) {
  const stories = load();
  const now = new Date().toISOString();
  const story = {
    id: newId(),
    title: input.title?.trim() || '未命名故事',
    description: input.description?.trim() ?? '',
    startNodeId: '',
    nodes: [],
    createdAt: now,
    updatedAt: now
  };
  // 新建即带一个起始节点，避免空故事无从编辑
  const firstNode = { id: newId(), type: 'story', title: '开场', body: '', choices: [] };
  story.nodes.push(firstNode);
  story.startNodeId = firstNode.id;
  stories.push(story);
  persist(stories);
  return story;
}

export function replaceStory(id, input) {
  const stories = load();
  const idx = stories.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const replaced = {
    id,
    title: input.title ?? stories[idx].title,
    description: input.description ?? '',
    startNodeId: input.startNodeId ?? '',
    nodes: input.nodes ?? [],
    createdAt: stories[idx].createdAt,
    updatedAt: now
  };
  stories[idx] = replaced;
  persist(stories);
  return replaced;
}

export function deleteStory(id) {
  const stories = load();
  const next = stories.filter((s) => s.id !== id);
  if (next.length === stories.length) return false;
  cache = next;
  persist(next);
  return true;
}
