// model.js —— 故事模型层
// 数据结构:
// {
//   title, startNodeId,
//   nodes: [
//     {
//       id, title, body, isEnding,
//       choices: [ { id, text, nextNodeId } ]
//     }
//   ]
// }
const crypto = require('node:crypto');

function newId(prefix = 'n') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function createEmptyStory() {
  return { title: '未命名故事', startNodeId: null, nodes: [] };
}

/**
 * 归一化故事对象，保证字段类型稳定，避免脏数据进入存储。
 * 同时根据 id 对节点去重（保留先出现的）。
 */
function normalizeStory(input) {
  const story = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const out = createEmptyStory();
  out.title = typeof story.title === 'string' ? story.title.slice(0, 200) : '未命名故事';
  out.startNodeId = story.startNodeId == null ? null : String(story.startNodeId);

  const seen = new Set();
  for (const rawNode of Array.isArray(story.nodes) ? story.nodes : []) {
    if (!rawNode || typeof rawNode !== 'object') continue;
    const id = rawNode.id == null ? newId('n') : String(rawNode.id);
    if (seen.has(id)) continue;
    seen.add(id);

    const choices = (Array.isArray(rawNode.choices) ? rawNode.choices : []).map((c) => {
      const choice = c && typeof c === 'object' ? c : {};
      return {
        id: choice.id == null ? newId('c') : String(choice.id),
        text: typeof choice.text === 'string' ? choice.text.slice(0, 500) : '',
        nextNodeId: choice.nextNodeId == null ? null : String(choice.nextNodeId),
      };
    });

    out.nodes.push({
      id,
      title: typeof rawNode.title === 'string' ? rawNode.title.slice(0, 200) : '',
      body: typeof rawNode.body === 'string' ? rawNode.body : '',
      isEnding: Boolean(rawNode.isEnding),
      choices,
    });
  }

  if (!out.nodes.some((n) => n.id === out.startNodeId)) out.startNodeId = null;
  return out;
}

/**
 * 结构校验，返回 { errors: [], warnings: [] }
 *  - error  会破坏读者路径，例如悬空选项、开始节点缺失
 *  - warning 不阻断，例如空标题 / 不可达节点 / 存在环
 */
function validateStory(story) {
  const errors = [];
  const warnings = [];
  const nodes = story.nodes || [];
  const idSet = new Set(nodes.map((n) => n.id));

  if (nodes.length === 0) {
    warnings.push('故事还没有任何节点，点击左侧「+ 新节点」开始创作。');
  }
  if (!story.startNodeId) {
    errors.push('尚未设置开始节点。');
  } else if (!idSet.has(story.startNodeId)) {
    errors.push('开始节点指向了不存在的节点。');
  }

  for (const node of nodes) {
    const where = node.title ? `节点「${node.title}」` : `节点 ${node.id}`;
    if (!node.title.trim()) warnings.push(`${where} 的标题为空。`);
    if (!node.body.trim()) warnings.push(`${where} 的正文为空。`);

    if (!node.isEnding && node.choices.length === 0) {
      warnings.push(`${where} 不是结局但没有任何选项，读者会在此卡住。`);
    }
    if (node.isEnding && node.choices.length > 0) {
      warnings.push(`${where} 已标记为结局，但仍带有选项（结局的选项不会展示给读者）。`);
    }
    node.choices.forEach((choice, i) => {
      const label = `第 ${i + 1} 个选项`;
      if (!choice.text.trim()) warnings.push(`${where}的${label}文本为空。`);
      if (!choice.nextNodeId) {
        errors.push(`${where}的${label}没有设置「去向节点」。`);
      } else if (!idSet.has(choice.nextNodeId)) {
        errors.push(`${where}的${label}指向了已删除或不存在的节点。`);
      }
    });
  }

  const reachable = new Set(collectReachable(story));
  if (story.startNodeId && idSet.has(story.startNodeId)) {
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        warnings.push(`${node.title ? `节点「${node.title}」` : `节点 ${node.id}`} 从开始节点不可达。`);
      }
    }
    if (hasCycle(story, reachable)) {
      warnings.push('故事路径中存在循环（读者可能无限绕圈），请确认这是有意设计。');
    }
  }

  return { errors, warnings };
}

/** 从开始节点沿选项做 BFS，返回可达节点 id 列表 */
function collectReachable(story) {
  const ids = [];
  if (!story.startNodeId) return ids;
  const byId = new Map((story.nodes || []).map((n) => [n.id, n]));
  const queue = [story.startNodeId];
  const seen = new Set(queue);
  while (queue.length) {
    const id = queue.shift();
    const node = byId.get(id);
    if (!node) continue;
    ids.push(id);
    for (const choice of node.choices || []) {
      if (choice.nextNodeId && !seen.has(choice.nextNodeId) && byId.has(choice.nextNodeId)) {
        seen.add(choice.nextNodeId);
        queue.push(choice.nextNodeId);
      }
    }
  }
  return ids;
}

/** 基于 Kahn 算法判断可达子图是否有环 */
function hasCycle(story, scope) {
  const byId = new Map((story.nodes || []).map((n) => [n.id, n]));
  const indegree = new Map();
  scope.forEach((id) => indegree.set(id, 0));
  for (const id of scope) {
    for (const choice of byId.get(id).choices || []) {
      if (choice.nextNodeId && indegree.has(choice.nextNodeId)) {
        indegree.set(choice.nextNodeId, indegree.get(choice.nextNodeId) + 1);
      }
    }
  }
  const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited += 1;
    for (const choice of byId.get(id).choices || []) {
      const next = choice.nextNodeId;
      if (next && indegree.has(next)) {
        indegree.set(next, indegree.get(next) - 1);
        if (indegree.get(next) === 0) queue.push(next);
      }
    }
  }
  return visited !== scope.size;
}

/**
 * 故事统计：节点数、结局数、可达结局、读者可选路径总数。
 * 路径数用记忆化 DFS（环上的路径不重复计数），并设置上限防止组合爆炸。
 */
function computeStats(story) {
  const nodes = story.nodes || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const reachable = new Set(collectReachable(story));
  const endings = nodes.filter((n) => n.isEnding);
  const reachableEndings = endings.filter((n) => reachable.has(n.id));

  const PATH_CAP = 10000;
  const memo = new Map();
  function countPaths(id, onStack) {
    if (memo.has(id)) return memo.get(id);
    const node = byId.get(id);
    if (!node) return 0;
    // 终点：结局节点，或没有有效出边的节点
    const exits = (node.choices || []).filter(
      (c) => c.nextNodeId && byId.has(c.nextNodeId),
    );
    if (node.isEnding || exits.length === 0) {
      memo.set(id, 1);
      return 1;
    }
    if (onStack.has(id)) return 0; // 回到当前递归路径上的节点，环上不再计数
    onStack.add(id);
    let total = 0;
    for (const choice of exits) {
      total += countPaths(choice.nextNodeId, onStack);
      if (total > PATH_CAP) { total = PATH_CAP + 1; break; }
    }
    onStack.delete(id);
    memo.set(id, total);
    return total;
  }

  const rawPathCount = story.startNodeId && byId.has(story.startNodeId)
    ? countPaths(story.startNodeId, new Set())
    : 0;
  const pathCountCapped = rawPathCount > PATH_CAP;

  return {
    nodeCount: nodes.length,
    endingCount: endings.length,
    reachableEndingCount: reachableEndings.length,
    unreachableCount: nodes.length - reachable.size,
    pathCount: Math.min(rawPathCount, PATH_CAP),
    pathCountCapped,
    hasCycle: story.startNodeId ? hasCycle(story, reachable) : false,
  };
}

module.exports = {
  newId,
  createEmptyStory,
  normalizeStory,
  validateStory,
  computeStats,
  collectReachable,
};
