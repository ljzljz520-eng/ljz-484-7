// main.js —— 前端入口：拉取初始故事、初始化编辑/预览模块、管理标签切换与保存状态
import { api } from './api.js';
import { state, hydrate, on, setSaveStatus } from './state.js';
import { toast } from './toast.js';
import { initEditor } from './editor.js';
import { initPreview, enterPreview } from './preview.js';

const els = {
  tabEdit: document.getElementById('tab-edit'),
  tabPreview: document.getElementById('tab-preview'),
  viewEdit: document.getElementById('view-edit'),
  viewPreview: document.getElementById('view-preview'),
  saveStatus: document.getElementById('save-status'),
};

const STATUS_TEXT = {
  idle: '未加载',
  saving: '保存中…',
  saved: '已自动保存',
  error: '保存失败',
};

function switchView(name) {
  const isEdit = name === 'edit';
  els.tabEdit.classList.toggle('active', isEdit);
  els.tabPreview.classList.toggle('active', !isEdit);
  els.viewEdit.classList.toggle('active', isEdit);
  els.viewPreview.classList.toggle('active', !isEdit);
  if (!isEdit) enterPreview();
}

async function boot() {
  // 状态灯
  on('status', (status) => {
    els.saveStatus.className = `save-status ${status}`;
    els.saveStatus.textContent = STATUS_TEXT[status] || status;
  });

  initEditor();
  initPreview();

  // 标签切换
  els.tabEdit.addEventListener('click', () => switchView('edit'));
  els.tabPreview.addEventListener('click', () => switchView('preview'));

  // 初始数据
  try {
    const payload = await api.getStory();
    hydrate(payload, { keepSelection: false });
    setSaveStatus(payload.story.nodes.length ? 'saved' : 'idle');
    els.saveStatus.textContent = payload.story.nodes.length
      ? '已加载（自动保存中）'
      : '空故事，开始创作吧';
  } catch (err) {
    setSaveStatus('error');
    els.saveStatus.textContent = '加载失败';
    toast(`无法加载故事：${err.message}（请确认后端已启动）`);
  }
}

boot();
