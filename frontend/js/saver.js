// saver.js —— 自动保存调度
// 设计：所有写操作走一个带「代际序号」的串行队列，避免乱序响应覆盖最新内容。
//  - 普通字段编辑：合并进 pending.patch，700ms 防抖后 PATCH
//  - 结构性变更（增删节点/选项、设置开始节点、标题）：立即 flush 后再执行
import { api } from './api.js';
import { state, hydrate, setSaveStatus } from './state.js';
import { toast } from './toast.js';

let generation = 0;        // 每次成功响应后递增；过期响应直接丢弃
let pendingNodeId = null;  // 待保存的节点字段补丁
let pendingPatch = null;
let debounceTimer = null;

function scheduleNodePatch(nodeId, patch) {
  if (pendingNodeId !== nodeId) {
    // 切换了编辑节点，先把上一个节点的修改落盘
    flush();
    pendingNodeId = nodeId;
    pendingPatch = {};
  }
  Object.assign(pendingPatch, patch);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flush, 700);
  setSaveStatus('saving');
}

/** 等待所有在途 / 防抖中的写操作完成（切换标签页前调用） */
export async function flush() {
  clearTimeout(debounceTimer);
  debounceTimer = null;
  if (!pendingNodeId) return;

  const nodeId = pendingNodeId;
  const patch = pendingPatch;
  pendingNodeId = null;
  pendingPatch = null;

  const gen = ++generation;
  setSaveStatus('saving');
  try {
    const payload = await api.updateNode(nodeId, patch);
    if (gen === generation) {
      hydrate(payload);
      setSaveStatus('saved');
    }
  } catch (err) {
    if (gen === generation) {
      setSaveStatus('error');
      toast(`自动保存失败：${err.message}`);
    }
  }
}

/**
 * 立即执行一个结构性写操作；先 flush 掉防抖中的编辑。
 * chooseId 可在响应返回后指定应选中的节点（在 hydrate 前设置）。
 */
export async function immediate(task, chooseId) {
  await flush();
  const gen = ++generation;
  setSaveStatus('saving');
  try {
    const payload = await task();
    if (gen === generation) {
      if (typeof chooseId === 'function') {
        const id = chooseId(payload);
        if (id) state.selectedNodeId = id;
      }
      hydrate(payload, { keepSelection: true });
      setSaveStatus('saved');
    }
    return payload;
  } catch (err) {
    if (gen === generation) {
      setSaveStatus('error');
      toast(`保存失败：${err.message}`);
    }
    throw err;
  }
}

// 编辑器动作
export const actions = {
  setStoryTitle: (title) =>
    immediate(() => api.putStory({ ...state.story, title })),

  setStartNode: (id) =>
    immediate(() => api.putStory({ ...state.story, startNodeId: id })),

  addNode: () =>
    immediate(async () => {
      const payload = await api.createNode({ title: '新节点' });
      return payload;
    }, (payload) => payload.node && payload.node.id),

  removeNode: (id) =>
    immediate(() => api.deleteNode(id), () =>
      (state.selectedNodeId === id ? state.story.startNodeId : state.selectedNodeId)),

  /** 正文/标题/结局标记：防抖补丁 */
  patchNode: (id, patch) => scheduleNodePatch(id, patch),

  addChoice: (nodeId) =>
    immediate(() => api.createChoice(nodeId, { text: '新选项' })),

  updateChoiceText: (nodeId, choiceId, text) =>
    immediate(() => api.updateChoice(nodeId, choiceId, { text })),

  updateChoiceTarget: (nodeId, choiceId, nextNodeId) =>
    immediate(() => api.updateChoice(nodeId, choiceId, { nextNodeId })),

  removeChoice: (nodeId, choiceId) =>
    immediate(() => api.deleteChoice(nodeId, choiceId)),
};
