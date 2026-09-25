// editor.js —— 编辑视图：侧栏（故事标题/节点列表/统计/校验）+ 工作区（节点与选项编辑）
import { h, clear } from './dom.js';
import { state, on, selectNode, storyChanged, hydrate, setSaveStatus } from './state.js';
import { actions, flush } from './saver.js';
import { api } from './api.js';

const els = {
  storyTitle: document.getElementById('story-title'),
  addNode: document.getElementById('btn-add-node'),
  nodeList: document.getElementById('node-list'),
  stats: document.getElementById('stats-panel'),
  validation: document.getElementById('validation-panel'),
  workspace: document.getElementById('workspace'),
};

/** 从开始节点做 BFS，返回不可达节点 id 集合（用于侧栏标记） */
function unreachableIds() {
  const { story } = state;
  const byId = new Map(story.nodes.map((n) => [n.id, n]));
  const seen = new Set();
  if (story.startNodeId && byId.has(story.startNodeId)) {
    const queue = [story.startNodeId];
    seen.add(story.startNodeId);
    while (queue.length) {
      const node = byId.get(queue.shift());
      for (const c of node.choices) {
        if (c.nextNodeId && byId.has(c.nextNodeId) && !seen.has(c.nextNodeId)) {
          seen.add(c.nextNodeId);
          queue.push(c.nextNodeId);
        }
      }
    }
  }
  return new Set(story.nodes.map((n) => n.id).filter((id) => !seen.has(id)));
}

/* ---------------- 侧栏：节点列表 ---------------- */

function renderNodeList() {
  const orphan = unreachableIds();
  clear(els.nodeList);

  for (const node of state.story.nodes) {
    const badges = [];
    if (node.id === state.story.startNodeId) badges.push(h('span', { class: 'badge badge-start' }, '开始'));
    if (node.isEnding) badges.push(h('span', { class: 'badge badge-end' }, '结局'));
    if (node.id !== state.story.startNodeId && orphan.has(node.id)) {
      badges.push(h('span', { class: 'badge badge-orphan' }, '不可达'));
    }
    els.nodeList.appendChild(
      h('button', {
        class: `node-item${node.id === state.selectedNodeId ? ' active' : ''}`,
        onclick: () => selectNode(node.id),
      }, [
        h('span', { class: 'node-name' }, node.title.trim() || '（未命名节点）'),
        h('span', { class: 'node-badges' }, badges),
      ]),
    );
  }

  if (state.story.nodes.length === 0) {
    els.nodeList.appendChild(
      h('div', { class: 'empty-state', style: 'padding:30px 10px;' }, [
        h('div', { class: 'big' }, '🗺️'),
        h('div', {}, '还没有节点，点击上方按钮创建'),
      ]),
    );
  }
}

/* ---------------- 侧栏：统计与校验 ---------------- */

function renderStats() {
  clear(els.stats);
  const s = state.stats;
  if (!s) return;
  const chips = [
    `节点 <b>${s.nodeCount}</b>`,
    `结局 <b>${s.endingCount}</b>`,
    `可达结局 <b>${s.reachableEndingCount}</b>`,
    `可选路径 <b>${s.pathCount}${s.pathCountCapped ? '+' : ''}</b> 条`,
  ];
  if (s.unreachableCount > 0) chips.push(`不可达 <b>${s.unreachableCount}</b>`);
  if (s.hasCycle) chips.push('⚠ 含循环');
  for (const chip of chips) {
    els.stats.appendChild(h('span', { class: 'stat-chip', html: chip }));
  }
}

function renderValidation() {
  clear(els.validation);
  const { errors, warnings } = state.validation;
  if (errors.length === 0 && warnings.length === 0) {
    els.validation.appendChild(h('div', { class: 'v-ok' }, '✓ 没有发现结构问题'));
    return;
  }
  if (errors.length) {
    els.validation.appendChild(h('div', { class: 'v-title' }, `错误（${errors.length}）——会阻断读者路径`));
    for (const msg of errors) els.validation.appendChild(h('div', { class: 'v-item v-error' }, msg));
  }
  if (warnings.length) {
    els.validation.appendChild(h('div', { class: 'v-title' }, `提示（${warnings.length}）`));
    for (const msg of warnings) els.validation.appendChild(h('div', { class: 'v-item v-warning' }, msg));
  }
}

/* ---------------- 工作区：节点编辑器 ---------------- */

function workspaceSignature(node) {
  if (!node) return 'none';
  return [
    node.id,
    node.isEnding ? 'end' : 'normal',
    node.choices.map((c) => `${c.id}>${c.nextNodeId || '0'}`).join('|'),
  ].join('#');
}

let lastSignature = '';

function renderWorkspace() {
  const node = state.story.nodes.find((n) => n.id === state.selectedNodeId) || null;
  const sig = workspaceSignature(node);
  if (sig === lastSignature && document.contains(els.workspace) && els.workspace.dataset.alive === '1') {
    return; // 只是文字编辑，保留 DOM 与输入焦点
  }
  lastSignature = sig;
  clear(els.workspace);

  if (!node) {
    els.workspace.dataset.alive = '0';
    els.workspace.appendChild(
      h('div', { class: 'empty-state' }, [
        h('div', { class: 'big' }, '📖'),
        h('div', {}, state.story.nodes.length ? '请在左侧选择一个节点' : '创建第一个故事节点开始吧'),
        state.story.nodes.length === 0
          ? h('button', { class: 'btn btn-primary', onclick: () => actions.addNode() }, '＋ 新节点')
          : null,
      ]),
    );
    return;
  }
  els.workspace.dataset.alive = '1';

  const isStart = state.story.startNodeId === node.id;
  const editor = h('div', { class: 'node-editor' }, [
    // 头部
    h('div', { class: 'editor-head' }, [
      h('h2', {}, '节点编辑'),
      h('div', { class: 'head-badges' }, [
        isStart ? h('span', { class: 'badge badge-start' }, '开始节点') : null,
        node.isEnding ? h('span', { class: 'badge badge-end' }, '结局节点') : null,
      ]),
      h('button', {
        class: `btn btn-sm${isStart ? '' : ' btn-ghost'}`,
        title: isStart ? '这个节点是读者进入故事的起点' : '将该节点设为故事起点',
        onclick: () => { if (!isStart) actions.setStartNode(node.id); },
        disabled: isStart,
      }, isStart ? '★ 起点' : '☆ 设为起点'),
      h('button', {
        class: 'btn btn-sm btn-danger',
        onclick: async () => {
          if (confirm(`确定删除节点「${node.title || '未命名'}」吗？指向它的选项也会被一并清理。`)) {
            await actions.removeNode(node.id);
          }
        },
      }, '删除节点'),
    ]),

    // 标题与正文
    h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, '节点标题'),
      h('input', {
        type: 'text',
        maxlength: '200',
        value: node.title,
        placeholder: '例如：迷雾森林的入口',
        oninput: (e) => {
          node.title = e.target.value;
          actions.patchNode(node.id, { title: node.title });
          storyChanged();
        },
      }),
      h('div', { class: 'card-title' }, '正文（读者看到的内容）'),
      h('textarea', {
        placeholder: '写下这个场景发生了什么……',
        oninput: (e) => {
          node.body = e.target.value;
          actions.patchNode(node.id, { body: node.body });
        },
      }, node.body),
    ]),

    // 结局设置
    h('div', { class: 'card' }, [
      h('label', { class: 'ending-row' }, [
        h('input', {
          type: 'checkbox',
          checked: node.isEnding ? true : false,
          onchange: (e) => {
            node.isEnding = e.target.checked;
            actions.patchNode(node.id, { isEnding: node.isEnding });
            storyChanged();
            renderWorkspace(); // 结局状态会影响选项区的提示
          },
        }),
        h('span', {}, '这是一个结局节点'),
        h('span', { class: 'ending-hint' }, '读者到达此处时故事结束，不再展示选项'),
      ]),
    ]),

    // 选项
    renderChoicesCard(node),
  ]);

  els.workspace.appendChild(editor);
}

function renderChoicesCard(node) {
  const card = h('div', { class: 'card' }, [
    h('div', { class: 'card-title' }, `读者选项（${node.choices.length}）`),
  ]);

  if (node.isEnding) {
    card.appendChild(h('div', { class: 'choices-notice' }, '结局节点不会向读者展示选项，但下方内容仍会保留，取消结局标记后恢复。'));
  }
  if (!node.isEnding && node.choices.length === 0) {
    card.appendChild(h('div', { class: 'choice-empty' }, '还没有选项。非结局节点至少需要一个选项，否则读者会在此卡住。'));
  }

  node.choices.forEach((choice, index) => {
    const targetExists = !choice.nextNodeId
      || state.story.nodes.some((n) => n.id === choice.nextNodeId);

    const select = h('select', {
      onchange: (e) => {
        choice.nextNodeId = e.target.value || null;
        actions.patchNode(node.id, { choices: node.choices });
        storyChanged();
      },
    }, [
      h('option', { value: '' }, targetExists ? '— 选择去向节点 —' : '⚠ 去向节点已丢失'),
      ...state.story.nodes
        .filter((n) => n.id !== node.id || choice.nextNodeId === n.id)
        .map((n) => h('option', {
          value: n.id,
          selected: choice.nextNodeId === n.id ? true : false,
        }, n.title.trim() || '（未命名节点）')),
    ]);

    card.appendChild(
      h('div', { class: 'choice-row' }, [
        h('div', { class: 'choice-order' }, `选项 ${index + 1}`),
        h('input', {
          type: 'text',
          value: choice.text,
          placeholder: '选项文字，例如：推开木门',
          oninput: (e) => {
            choice.text = e.target.value;
            actions.patchNode(node.id, { choices: node.choices });
          },
        }),
        select,
        h('button', {
          class: 'icon-btn',
          title: '删除选项',
          onclick: async () => { await actions.removeChoice(node.id, choice.id); },
        }, '✕'),
      ]),
    );
  });

  card.appendChild(
    h('div', { class: 'danger-zone' }, [
      h('button', {
        class: 'btn btn-sm',
        onclick: () => actions.addChoice(node.id),
      }, '＋ 添加选项'),
    ]),
  );
  return card;
}

/* ---------------- 事件绑定与重渲染 ---------------- */

function renderSidebar() {
  if (document.activeElement !== els.storyTitle) {
    els.storyTitle.value = state.story.title;
  }
  renderNodeList();
  renderStats();
  renderValidation();
}

export function initEditor() {
  els.storyTitle.addEventListener('input', (e) => {
    state.story.title = e.target.value;
    // 故事标题独立防抖：直接用 PUT 全量保存，复用 saver 的即时通道太重，这里轻量防抖
    scheduleTitleSave(e.target.value);
  });
  els.addNode.addEventListener('click', () => actions.addNode());

  on('story', () => {
    renderSidebar();
    renderWorkspace();
  });
  on('select', () => {
    renderNodeList();
    lastSignature = ''; // 切换节点时强制重建工作区
    renderWorkspace();
  });

  // 离开编辑页前先把防抖中的修改落盘
  document.getElementById('tab-preview').addEventListener('click', () => flush());
}

let titleTimer = null;
function scheduleTitleSave(title) {
  clearTimeout(titleTimer);
  setSaveStatus('saving');
  titleTimer = setTimeout(async () => {
    try {
      hydrate(await api.putStory({ ...state.story, title }));
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
    }
  }, 700);
}
