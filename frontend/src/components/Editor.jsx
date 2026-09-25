import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api.js';
import NodeEditor from './NodeEditor.jsx';
import Preview from './Preview.jsx';

export default function Editor({ storyId, onBack }) {
  const [story, setStory] = useState(null);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [tab, setTab] = useState('edit'); // edit | preview
  const [feedback, setFeedback] = useState(null); // {kind:'ok'|'error'|'warn', msg, errors, warnings}
  const [saving, setSaving] = useState(false);
  const savedSnapshot = useRef('');

  useEffect(() => {
    api.getStory(storyId).then((s) => {
      setStory(s);
      setActiveNodeId(s.startNodeId || s.nodes[0]?.id || null);
      savedSnapshot.current = JSON.stringify(s);
    });
  }, [storyId]);

  const dirty = useMemo(
    () => story && JSON.stringify(story) !== savedSnapshot.current,
    [story]
  );

  if (!story) return <div className="placeholder">载入故事中…</div>;

  const patchStory = (patch) => setStory((s) => ({ ...s, ...patch }));

  const patchNode = (nodeId, patch) =>
    setStory((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n))
    }));

  const addNode = () => {
    const node = { id: api.genId(), type: 'story', title: '新节点', body: '', choices: [] };
    setStory((s) => ({ ...s, nodes: [...s.nodes, node] }));
    setActiveNodeId(node.id);
  };

  const deleteNode = (nodeId) => {
    const node = story.nodes.find((n) => n.id === nodeId);
    if (!confirm(`删除节点「${node.title || nodeId}」？指向它的选项也会一并移除。`)) return;
    setStory((s) => ({
      ...s,
      startNodeId: s.startNodeId === nodeId ? '' : s.startNodeId,
      nodes: s.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => ({
          ...n,
          choices: n.choices.filter((c) => c.targetNodeId !== nodeId)
        }))
    }));
    setActiveNodeId((cur) =>
      cur === nodeId ? story.nodes.find((n) => n.id !== nodeId)?.id ?? null : cur
    );
  };

  const runValidate = async () => {
    try {
      const result = await api.validateStory(storyId, story);
      setFeedback({ kind: result.valid ? 'ok' : 'error', ...result });
      return result;
    } catch (e) {
      setFeedback({ kind: 'error', errors: [e.message], warnings: [] });
      return null;
    }
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await api.saveStory(storyId, story);
      savedSnapshot.current = JSON.stringify(result.story);
      setStory(result.story);
      setFeedback({
        kind: result.warnings.length ? 'warn' : 'ok',
        msg: '已保存到后端（data/stories.json）',
        errors: result.errors,
        warnings: result.warnings
      });
    } catch (e) {
      if (e.status === 422) {
        setFeedback({ kind: 'error', msg: '保存被拒绝：存在结构性错误', ...e.payload });
      } else {
        setFeedback({ kind: 'error', errors: [e.message], warnings: [] });
      }
    } finally {
      setSaving(false);
    }
  };

  const activeNode = story.nodes.find((n) => n.id === activeNodeId) || null;

  return (
    <main className="editor">
      <div className="editor-toolbar">
        <button className="btn" onClick={onBack}>← 返回列表</button>
        <input
          className="title-input"
          value={story.title}
          onChange={(e) => patchStory({ title: e.target.value })}
          placeholder="故事标题"
        />
        <div className="tabs">
          <button className={`tab ${tab === 'edit' ? 'active' : ''}`} onClick={() => setTab('edit')}>
            ✏️ 编辑
          </button>
          <button className={`tab ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>
            ▶️ 读者预览
          </button>
        </div>
        <button className="btn" onClick={runValidate}>检查</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '保存中…' : dirty ? '💾 保存' : '✓ 已保存'}
        </button>
      </div>

      <input
        className="desc-input"
        value={story.description}
        onChange={(e) => patchStory({ description: e.target.value })}
        placeholder="故事简介（可选）"
      />

      {feedback && (
        <div className={`banner banner-${feedback.kind === 'ok' ? 'ok' : feedback.kind === 'warn' ? 'warn' : 'error'}`}>
          {feedback.msg && <div>{feedback.msg}</div>}
          {feedback.errors?.map((e, i) => <div key={`e${i}`}>❌ {e}</div>)}
          {feedback.warnings?.map((w, i) => <div key={`w${i}`}>⚠️ {w}</div>)}
        </div>
      )}

      {tab === 'edit' ? (
        <div className="editor-body">
          <aside className="node-list">
            <div className="node-list-header">
              <span>节点（{story.nodes.length}）</span>
              <button className="btn btn-small" onClick={addNode}>+ 节点</button>
            </div>
            {story.nodes.map((n) => (
              <div
                key={n.id}
                className={`node-item ${n.id === activeNodeId ? 'active' : ''}`}
                onClick={() => setActiveNodeId(n.id)}
              >
                <span className={`badge badge-${n.type}`}>
                  {n.type === 'ending' ? '结局' : '剧情'}
                </span>
                <span className="node-item-title">{n.title || '（未命名）'}</span>
                {n.id === story.startNodeId && <span className="start-tag" title="起始节点">起</span>}
              </div>
            ))}
          </aside>

          {activeNode ? (
            <NodeEditor
              key={activeNode.id}
              story={story}
              node={activeNode}
              onPatch={(patch) => patchNode(activeNode.id, patch)}
              onPatchStory={patchStory}
              onDelete={() => deleteNode(activeNode.id)}
            />
          ) : (
            <div className="placeholder">选择或新建一个节点开始编辑。</div>
          )}
        </div>
      ) : (
        <Preview story={story} />
      )}
    </main>
  );
}
