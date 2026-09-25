import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import storyRoutes from './routes/stories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/stories', storyRoutes);

// 生产模式下直接托管前端构建产物（frontend/dist）
const distDir = join(__dirname, '..', '..', 'frontend', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(join(distDir, 'index.html')));
}

// 统一错误处理（JSON 解析失败等）
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || '服务器错误' });
});

app.listen(PORT, () => {
  console.log(`故事编辑器后端运行在 http://localhost:${PORT}`);
});
