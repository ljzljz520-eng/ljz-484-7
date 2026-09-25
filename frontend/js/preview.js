// preview.js —— 读者预览视图
// 直接使用编辑器当前内存中的故事（编辑会自动保存，这里看到的始终是最新内容），
// 在前端模拟读者点击选项后的节点跳转路径，不经过后端。
import { h, clear } from './dom.js';
import { state, on } from './state.js';
import { flush } from './saver.js';

const els = {
  reader: document.getElementById('reader'),
  trail: document.getElementById('path-trail'),
  info: document.getElementById('path-info'),
  restart: document.getElementById('btn-restart'),
};

// 当前读者位置；trail 记录 [{ nodeId, choiceId | null }]
let currentId = null;
let trail = [];

function reset() {
  currentId = state.story.startNodeId;
  trail = currentId ? [{ nodeId: currentId, choiceId: null }] : [];
}

function currentNode() {
  return state.story.nodes.find((n) => n.id === currentId) || null;
}

function go(choice) {
  trail.push({ nodeId: currentId, choiceId: choice.id });
  currentId = choice.nextNodeId;
  trail.push({ nodeId: currentId, choiceId: null });
  render();
}

/* ---------------- 渲染 ---------------- */

function renderReader() {
  clear(els.reader);

  if (state.story.nodes.length === 0) {
    els.reader.appendChild(placeholder('故事还是空的，回到「编辑」创建节点吧。'));
    return;
  }
  if (!state.story.startNodeId) {
    els.reader.appendChild(placeholder('还没有设置开始节点。在编辑器中点击某个节点的「☆ 设为起点」。'));
    return;
  }
  if (!currentNode() && trail.length === 0) {
    els.reader.appendChild(placeholder('开始节点已失效，请回到编辑视图重新设置。'));
    return;
  }
  if (!currentNode()) {
    // 选项指向的节点被删除等异常情况
    els.reader.appendChild(
      h('div', { class: 'reader-placeholder' }, [
        h('div', {}, '⚠ 下一个节点不存在（可能已被删除）。'),
        h('button', {
          class: 'btn btn-primary',
          style: 'margin-top:14px;',
          onclick: () => { reset(); render(); },
        }, '重新开始'),
      ]),
    );
    return;
  }

  const node = currentNode();
  const stepCount = trail.filter((t) => t.choiceId).length;
  const inner = h('div', { class: 'reader-inner' }, [
    h('div', { class: 'r-kicker' }, node.isEnding ? '— 结局 —' : `第 ${stepCount + 1} 幕`),
    h('h2', { class: 'r-title' }, node.title.trim() || '（未命名节点）'),
    h('div', { class: 'r-body' }, node.body.trim() ? node.body : '（此节点还没有正文）'),
  ]);

  if (node.isEnding) {
    inner.appendChild(h('div', {}, h('span', { class: 'r-end' }, 'THE END')));
    inner.appendChild(
      h('button', {
        class: 'btn btn-ghost',
        style: 'margin-top:26px;',
        onclick: () => { reset(); render(); },
      }, '↺ 再读一遍'),
    );
  } else {
    const usable = node.choices.filter((c) => c.nextNodeId);
    if (node.choices.length === 0) {
      inner.appendChild(h('div', { class: 'r-warn' }, '⚠ 作者没有在此放置任何选项，故事在此中断（非结局）。'));
    } else if (usable.length === 0) {
      inner.appendChild(h('div', { class: 'r-warn' }, '⚠ 这里的选项都还没有设置去向节点。'));
    } else {
      const brokenCount = node.choices.length - usable.length;
      inner.appendChild(
        h('div', { class: 'choice-btns' },
          usable.map((choice) => h('button', {
            class: 'choice-btn',
            onclick: () => go(choice),
          }, [
            document.createTextNode(choice.text.trim() || '（未命名选项）'),
            h('span', { class: 'arrow' }, ' →'),
          ])),
        ),
      );
      if (brokenCount > 0) {
        inner.appendChild(h('div', { class: 'r-warn' }, `另有 ${brokenCount} 个选项未设置去向，已对读者隐藏。`));
      }
    }
  }

  els.reader.appendChild(inner);
  els.reader.scrollTop = 0;
}

function renderTrail() {
  clear(els.trail);
  const nodeTitle = (id) => {
    const n = state.story.nodes.find((x) => x.id === id);
    return n ? (n.title.trim() || '未命名节点') : '（缺失节点）';
  };
  for (const step of trail) {
    if (step.choiceId) {
      const node = state.story.nodes.find((n) => n.id === step.nodeId);
      const choice = node && node.choices.find((c) => c.id === step.choiceId);
      els.trail.appendChild(
        h('li', { html: `选择了 <span class="trail-choice">${escapeHtml(choice ? choice.text : '未知选项')}</span>` }),
      );
    } else {
      els.trail.appendChild(
        h('li', { html: `到达 <span class="trail-node">${escapeHtml(nodeTitle(step.nodeId))}</span>` }),
      );
    }
  }
  const moves = trail.filter((t) => t.choiceId).length;
  const node = currentNode();
  clear(els.info);
  if (node) {
    els.info.textContent = `已做选择 ${moves} 次 · 当前${node.isEnding ? '是结局' : '可继续'}`;
  } else {
    els.info.textContent = `已做选择 ${moves} 次`;
  }
}

function placeholder(text) {
  return h('div', { class: 'reader-placeholder' }, h('div', {}, text));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function render() {
  renderReader();
  renderTrail();
}

export function initPreview() {
  els.restart.addEventListener('click', () => { reset(); render(); });

  // 切回编辑会 flush；故事结构在保存后变化时，如果读者已走到不存在的节点则重置
  on('story', () => {
    if (!state.story.nodes.some((n) => n.id === currentId)) reset();
    render();
  });

  // 首次切到预览前把防抖中的修改落盘，保证读到的与编辑器一致
  document.getElementById('tab-preview').addEventListener('click', () => flush());
}

/** 每次切进预览页时调用 */
export function enterPreview() {
  reset();
  render();
}
