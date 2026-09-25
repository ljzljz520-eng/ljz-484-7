import React, { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';
import StoryList from './components/StoryList.jsx';
import Editor from './components/Editor.jsx';

export default function App() {
  const [stories, setStories] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setStories(await api.getStories());
      setError('');
    } catch (e) {
      setError(`无法连接后端：${e.message}（请确认 backend 已在 :4000 启动）`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    const story = await api.createStory({ title: '未命名故事' });
    await refresh();
    setCurrentId(story.id);
  };

  const handleDelete = async (id) => {
    await api.deleteStory(id);
    if (currentId === id) setCurrentId(null);
    await refresh();
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>📖 互动故事编辑器</h1>
        <span className="subtitle">节点 · 选项 · 正文 · 结局</span>
      </header>

      {error && <div className="banner banner-error">{error}</div>}

      {loading ? (
        <div className="placeholder">加载中…</div>
      ) : currentId ? (
        <Editor
          key={currentId}
          storyId={currentId}
          onBack={() => {
            setCurrentId(null);
            refresh();
          }}
        />
      ) : (
        <StoryList stories={stories} onCreate={handleCreate} onOpen={setCurrentId} onDelete={handleDelete} />
      )}
    </div>
  );
}
