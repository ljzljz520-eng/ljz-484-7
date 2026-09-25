// api.js —— 后端 REST 接口封装
const BASE = '/api';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `请求失败（${res.status}）`);
  }
  return data;
}

export const api = {
  getStory: () => request('GET', '/story'),
  putStory: (story) => request('PUT', '/story', story),

  createNode: (payload = {}) => request('POST', '/nodes', payload),
  updateNode: (id, patch) => request('PATCH', `/nodes/${encodeURIComponent(id)}`, patch),
  deleteNode: (id) => request('DELETE', `/nodes/${encodeURIComponent(id)}`),

  createChoice: (nodeId, payload = {}) =>
    request('POST', `/nodes/${encodeURIComponent(nodeId)}/choices`, payload),
  updateChoice: (nodeId, choiceId, patch) =>
    request('PATCH', `/nodes/${encodeURIComponent(nodeId)}/choices/${encodeURIComponent(choiceId)}`, patch),
  deleteChoice: (nodeId, choiceId) =>
    request('DELETE', `/nodes/${encodeURIComponent(nodeId)}/choices/${encodeURIComponent(choiceId)}`),
};
