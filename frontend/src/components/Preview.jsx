import React, { useEffect, useMemo, useState } from 'react';

// 读者视角预览：从起始节点开始，按选项走，并记录选择路径
export default function Preview({ story }) {
  const [currentId, setCurrentId] = useState(story.startNodeId || '');
  const [path, setPath] = useState([]); // [{nodeId, choiceText?}]

  // 故事被编辑时，若当前节点被删则回到起点
  useEffect(() => {
    if (!story.nodes.some((n) => n.id === currentId)) {
      setCurrentId(story.startNodeId || '');
      setPath([]);
    }
  }, [story, currentId]);

  const nodeMap = useMemo(() => new Map(story.nodes.map((n) => [n.id, n])), [story.nodes]);
  const current = nodeMap.get(currentId);

  const restart = () => {
    setCurrentId(story.startNodeId || '');
    setPath([]);
  };

  const choose = (choice) => {
    setPath((p) => [...p, { nodeId: currentId, choiceText: choice.text }]);
    setCurrentId(choice.targetNodeId);
  };

  const jumpBack = (index) => {
    // index 是 path 中要回到的那一步；回到该步所在的节点并截掉后续路径
    setPath(path.slice(0, index + 1).map((step, i) => (i === index ? { nodeId: step.nodeId } : step)));
    const targetId = path[index].nodeId;
    setCurrentId(targetId);
  };

  if (!story.startNodeId || !nodeMap.has(story.startNodeId)) {
    return (
      <div className="preview">
        <div className="banner banner-error">请先在编辑模式把某个节点设为「★ 起始节点」。</div>
      </div>
    );
  }

  return (
    <div className="preview">
      <div className="preview-side">
        <div className="path-header">
          <strong>选择路径</strong>
          <button className="btn btn-small" onClick={restart}>↺ 重新开始</button>
        </div>
        <ol className="path-list">
          <li>
            <button className="path-link" onClick={() => { setCurrentId(story.startNodeId); setPath([]); }}>
              {nodeMap.get(story.startNodeId)?.title || '开场'}（起点）
            </button>
          </li>
          {path.map((step, i) => (
            <li key={i}>
              <button className="path-link" onClick={() => jumpBack(i)} title="点击回到此步">
                {step.choiceText ? `「${step.choiceText}」→ ` : ''}
                {nodeMap.get(step.nodeId)?.title || '（节点已删除）'}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <article className="reader-view">
        {!current ? (
          <div className="banner banner-error">选项指向了不存在的节点，请回到编辑模式修复。</div>
        ) : (
          <>
            <h2 className="reader-title">
              {current.type === 'ending' && <span className="ending-flag">🏁 结局 · </span>}
              {current.title || '（未命名节点）'}
            </h2>
            <p className="reader-body">{current.body || '（此节点还没有正文）'}</p>

            {current.type === 'ending' ? (
              <div className="reader-end">
                <p>—— 故事线结束 ——</p>
                <button className="btn btn-primary" onClick={restart}>再玩一次</button>
              </div>
            ) : current.choices.length === 0 ? (
              <div className="banner banner-warn">此剧情节点没有选项，读者卡在这里（保存时会收到警告）。</div>
            ) : (
              <div className="reader-choices">
                {current.choices.map((c) => {
                  const exists = nodeMap.has(c.targetNodeId);
                  return (
                    <button
                      key={c.id}
                      className="choice-btn"
                      disabled={!exists || !c.text.trim()}
                      title={!exists ? '目标节点不存在' : !c.text.trim() ? '选项文字为空' : ''}
                      onClick={() => choose(c)}
                    >
                      {c.text.trim() || '（空选项）'}
                      {!exists && ' ⚠️ 目标缺失'}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </article>
    </div>
  );
}
