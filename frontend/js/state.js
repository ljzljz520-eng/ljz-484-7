// state.js —— 前端内存状态 + 简单事件总线
// 后端返回的 { story, validation, stats } 统一通过 hydrate 进入状态。
export const state = {
  story: { title: '', startNodeId: null, nodes: [] },
  validation: { errors: [], warnings: [] },
  stats: null,
  selectedNodeId: null,
  saveStatus: 'idle', // idle | saving | saved | error
};

const listeners = new Map();

export function on(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => listeners.get(event).delete(cb);
}

function emit(event, payload) {
  const set = listeners.get(event);
  if (set) for (const cb of set) cb(payload);
}

/** 用服务端响应整体替换本地状态 */
export function hydrate(payload, { keepSelection = true } = {}) {
  state.story = payload.story;
  state.validation = payload.validation;
  state.stats = payload.stats;
  if (!keepSelection || !state.story.nodes.some((n) => n.id === state.selectedNodeId)) {
    state.selectedNodeId = state.story.startNodeId;
  }
  emit('story');
  emit('select');
}

export function getSelectedNode() {
  return state.story.nodes.find((n) => n.id === state.selectedNodeId) || null;
}

export function getNode(id) {
  return state.story.nodes.find((n) => n.id === id) || null;
}

export function selectNode(id) {
  if (state.selectedNodeId === id) return;
  state.selectedNodeId = id;
  emit('select');
}

export function setSaveStatus(status) {
  state.saveStatus = status;
  emit('status', status);
}

/** 本地直接改完故事后调用（自动保存会稍后同步服务端） */
export function storyChanged() {
  emit('story');
}
