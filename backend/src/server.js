// server.js —— HTTP 服务入口（零依赖）
//   - /api/...  故事 CRUD JSON 接口
//   - 其余路径  托管 frontend/ 下的静态资源
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const { loadStory, saveStory } = require('./store');
const {
  newId,
  normalizeStory,
  validateStory,
  computeStats,
} = require('./model');

const PORT = Number(process.env.PORT || 4173);
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const MAX_BODY_BYTES = 1024 * 1024; // 1MB

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function envelope(story) {
  return { story, validation: validateStory(story), stats: computeStats(story) };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('请求体过大（上限 1MB）'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(Object.assign(new Error(`JSON 解析失败: ${err.message}`), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// ---------- 业务处理 ----------

async function handleGetStory(req, res) {
  sendJson(res, 200, envelope(await loadStory()));
}

async function handlePutStory(req, res) {
  const incoming = normalizeStory(await readBody(req));
  await saveStory(incoming);
  sendJson(res, 200, envelope(incoming));
}

async function createNode(req, res) {
  const body = await readBody(req);
  const story = normalizeStory(await loadStory());
  const node = {
    id: newId('n'),
    title: typeof body.title === 'string' && body.title.trim() ? body.title : '新节点',
    body: typeof body.body === 'string' ? body.body : '',
    isEnding: body.isEnding === true,
    choices: [],
  };
  story.nodes.push(node);
  if (!story.startNodeId) story.startNodeId = node.id;
  await saveStory(story);
  sendJson(res, 201, { ...envelope(story), node });
}

async function updateNode(req, res, id) {
  const body = await readBody(req);
  const story = normalizeStory(await loadStory());
  const node = story.nodes.find((n) => n.id === id);
  if (!node) throw Object.assign(new Error('节点不存在'), { statusCode: 404 });

  if (typeof body.title === 'string') node.title = body.title.slice(0, 200);
  if (typeof body.body === 'string') node.body = body.body;
  if (typeof body.isEnding === 'boolean') node.isEnding = body.isEnding;
  if (Array.isArray(body.choices)) {
    node.choices = body.choices.map((c) => ({
      id: c && c.id != null ? String(c.id) : newId('c'),
      text: c && typeof c.text === 'string' ? c.text.slice(0, 500) : '',
      nextNodeId: c && c.nextNodeId != null ? String(c.nextNodeId) : null,
    }));
  }
  await saveStory(story);
  sendJson(res, 200, envelope(story));
}

async function deleteNode(req, res, id) {
  const story = normalizeStory(await loadStory());
  const idx = story.nodes.findIndex((n) => n.id === id);
  if (idx === -1) throw Object.assign(new Error('节点不存在'), { statusCode: 404 });

  story.nodes.splice(idx, 1);
  // 清理其他节点指向被删节点的选项
  for (const node of story.nodes) {
    node.choices = node.choices.filter((c) => c.nextNodeId !== id);
  }
  if (story.startNodeId === id) {
    story.startNodeId = story.nodes[0] ? story.nodes[0].id : null;
  }
  await saveStory(story);
  sendJson(res, 200, envelope(story));
}

async function createChoice(req, res, nodeId) {
  const body = await readBody(req);
  const story = normalizeStory(await loadStory());
  const node = story.nodes.find((n) => n.id === nodeId);
  if (!node) throw Object.assign(new Error('节点不存在'), { statusCode: 404 });

  const choice = {
    id: newId('c'),
    text: typeof body.text === 'string' && body.text.trim() ? body.text : '新选项',
    nextNodeId: body.nextNodeId != null ? String(body.nextNodeId) : null,
  };
  node.choices.push(choice);
  await saveStory(story);
  sendJson(res, 201, { ...envelope(story), choice });
}

async function updateChoice(req, res, nodeId, choiceId) {
  const body = await readBody(req);
  const story = normalizeStory(await loadStory());
  const node = story.nodes.find((n) => n.id === nodeId);
  if (!node) throw Object.assign(new Error('节点不存在'), { statusCode: 404 });
  const choice = node.choices.find((c) => c.id === choiceId);
  if (!choice) throw Object.assign(new Error('选项不存在'), { statusCode: 404 });

  if (typeof body.text === 'string') choice.text = body.text.slice(0, 500);
  if (Object.prototype.hasOwnProperty.call(body, 'nextNodeId')) {
    choice.nextNodeId = body.nextNodeId == null ? null : String(body.nextNodeId);
  }
  await saveStory(story);
  sendJson(res, 200, envelope(story));
}

async function deleteChoice(req, res, nodeId, choiceId) {
  const story = normalizeStory(await loadStory());
  const node = story.nodes.find((n) => n.id === nodeId);
  if (!node) throw Object.assign(new Error('节点不存在'), { statusCode: 404 });
  const before = node.choices.length;
  node.choices = node.choices.filter((c) => c.id !== choiceId);
  if (node.choices.length === before) {
    throw Object.assign(new Error('选项不存在'), { statusCode: 404 });
  }
  await saveStory(story);
  sendJson(res, 200, envelope(story));
}

// ---------- 路由 ----------

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const method = req.method;

  // /api/story
  if (parts.length === 2 && parts[1] === 'story') {
    if (method === 'GET') return handleGetStory(req, res);
    if (method === 'PUT') return handlePutStory(req, res);
  }
  // /api/nodes
  if (parts.length === 2 && parts[1] === 'nodes' && method === 'POST') {
    return createNode(req, res);
  }
  // /api/nodes/:id
  if (parts.length === 3 && parts[1] === 'nodes') {
    if (method === 'PATCH') return updateNode(req, res, decodeURIComponent(parts[2]));
    if (method === 'DELETE') return deleteNode(req, res, decodeURIComponent(parts[2]));
  }
  // /api/nodes/:id/choices
  if (parts.length === 4 && parts[1] === 'nodes' && parts[3] === 'choices' && method === 'POST') {
    return createChoice(req, res, decodeURIComponent(parts[2]));
  }
  // /api/nodes/:id/choices/:cid
  if (parts.length === 5 && parts[1] === 'nodes' && parts[3] === 'choices') {
    const nodeId = decodeURIComponent(parts[2]);
    const choiceId = decodeURIComponent(parts[4]);
    if (method === 'PATCH') return updateChoice(req, res, nodeId, choiceId);
    if (method === 'DELETE') return deleteChoice(req, res, nodeId, choiceId);
  }
  sendJson(res, 404, { error: '未知的 API 路径' });
}

// ---------- 静态文件 ----------

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';

  // 防目录穿越
  const filePath = path.normalize(path.join(FRONTEND_DIR, rel));
  if (!filePath.startsWith(FRONTEND_DIR + path.sep) && filePath !== FRONTEND_DIR) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // 单页应用回退：未知 GET 路径返回 index.html
      const fallback = path.join(FRONTEND_DIR, 'index.html');
      fs.readFile(fallback, (e, data) => {
        if (e) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------- 启动 ----------

const server = http.createServer(async (req, res) => {
  // 允许前端在开发时通过其他端口 / Live Server 访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: '不支持的方法' });
    }
    return serveStatic(req, res, url);
  } catch (err) {
    const status = err.statusCode || 500;
    sendJson(res, status, { error: err.message || '服务器内部错误' });
  }
});

server.listen(PORT, () => {
  console.log(`互动故事编辑器已启动: http://localhost:${PORT}`);
});

module.exports = server;
