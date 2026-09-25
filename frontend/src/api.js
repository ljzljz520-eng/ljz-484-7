// 后端 API 封装；开发环境经 Vite 代理转发到 :4000
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `请求失败 (${res.status})`);
    err.status = res.status;
    err.payload = data; // 校验错误的 errors/warnings 在里面
    throw err;
  }
  return data;
}

export const getStories = () => request('/stories');
export const createStory = (payload = {}) =>
  request('/stories', { method: 'POST', body: JSON.stringify(payload) });
export const getStory = (id) => request(`/stories/${id}`);
export const saveStory = (id, story) =>
  request(`/stories/${id}`, { method: 'PUT', body: JSON.stringify(story) });
export const deleteStory = (id) =>
  request(`/stories/${id}`, { method: 'DELETE' });
export const validateStory = (id, story) =>
  request(`/stories/${id}/validate`, {
    method: 'POST',
    body: JSON.stringify(story)
  });

// 生成节点 / 选项 id（旧浏览器兜底）
export const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
