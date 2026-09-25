import React from 'react';

export default function StoryList({ stories, onCreate, onOpen, onDelete }) {
  return (
    <main className="story-list">
      <div className="list-header">
        <h2>我的故事</h2>
        <button className="btn btn-primary" onClick={onCreate}>+ 新建故事</button>
      </div>

      {stories.length === 0 && (
        <div className="placeholder">还没有故事，点击「新建故事」开始创作。</div>
      )}

      <div className="cards">
        {stories.map((s) => (
          <div className="card" key={s.id}>
            <div className="card-body" onClick={() => onOpen(s.id)}>
              <h3>{s.title}</h3>
              <p className="card-desc">{s.description || '（暂无简介）'}</p>
              <div className="card-meta">
                <span>{s.nodeCount} 个节点</span>
                <span>{s.endingCount} 个结局</span>
              </div>
            </div>
            <button
              className="btn btn-danger btn-small"
              onClick={() => {
                if (confirm(`确定删除故事「${s.title}」？此操作不可恢复。`)) onDelete(s.id);
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
