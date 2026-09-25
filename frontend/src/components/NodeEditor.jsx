import * as api from '../api.js';
import React from 'react';

export default function NodeEditor({ story, node, onPatch, onPatchStory, onDelete }) {
  const isEnding = node.type === 'ending';

  const updateChoice = (choiceId, patch) =>
    onPatch({
      choices: node.choices.map((c) => (c.id === choiceId ? { ...c, ...patch } : c))
    });

  const addChoice = () =>
    onPatch({
      choices: [...node.choices, { id: api.genId(), text: '', targetNodeId: '' }]
    });

  const removeChoice = (choiceId) =>
    onPatch({ choices: node.choices.filter((c) => c.id !== choiceId) });

  // 选项里显示的目标节点：按标题列出，标注哪些是结局
  const targetOptions = story.nodes.filter((n) => n.id !== node.id);

  return (
    <section className="node-editor">
      <div className="node-editor-header">
        <select
          className="type-select"
          value={node.type}
          onChange={(e) => onPatch({ type: e.target.value })}
        >
          <option value="story">剧情节点</option>
          <option value="ending">结局节点</option>
        </select>
        <input
          className="node-title-input"
          value={node.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="节点标题（例如：午夜叩门）"
        />
        <button
          className={`btn btn-small ${story.startNodeId === node.id ? 'btn-active' : ''}`}
          onClick={() =>
            onPatchStory({ startNodeId: story.startNodeId === node.id ? '' : node.id })
          }
          title="读者进入故事后的第一个节点"
        >
          {story.startNodeId === node.id ? '★ 起始节点' : '设为起始'}
        </button>
        <button className="btn btn-small btn-danger" onClick={onDelete}>删除节点</button>
      </div>

      <label className="field-label">正文</label>
      <textarea
        className="body-area"
        value={node.body}
        onChange={(e) => onPatch({ body: e.target.value })}
        placeholder="写下这个节点的正文。读者在这里阅读剧情，然后通过下方选项前往其他节点……"
        rows={10}
      />

      {!isEnding && (
        <>
          <div className="choices-header">
            <label className="field-label">选项（指向其他节点，形成分支）</label>
            <button className="btn btn-small" onClick={addChoice}>+ 选项</button>
          </div>

          {node.choices.length === 0 && (
            <div className="hint">剧情节点需要至少一个选项，否则读者会卡死。</div>
      )}

          {node.choices.map((c) => {
            const dangling = c.targetNodeId && !story.nodes.some((n) => n.id === c.targetNodeId);
            return (
              <div className="choice-row" key={c.id}>
                <input
                  className="choice-text"
                  value={c.text}
                  onChange={(e) => updateChoice(c.id, { text: e.target.value })}
                  placeholder="选项文字，例如：壮起胆子开门"
                />
                <span className="arrow">→</span>
                <select
                  className={`choice-target ${dangling ? 'invalid' : ''}`}
                  value={c.targetNodeId}
                  onChange={(e) => updateChoice(c.id, { targetNodeId: e.target.value })}
                >
                  <option value="">— 选择目标节点 —</option>
                  {targetOptions.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title || '（未命名）'} {n.type === 'ending' ? '〔结局〕' : ''}
                    </option>
                  ))}
                </select>
                <button className="btn btn-small btn-ghost" onClick={() => removeChoice(c.id)}>
                  ✕
                </button>
              </div>
            );
          })}
        </>
      )}

      {isEnding && (
        <div className="hint ending-hint">
          🏁 这是一个结局节点，不需要选项。读者抵达此处即完成这一条故事线。
        </div>
      )}
    </section>
  );
}
