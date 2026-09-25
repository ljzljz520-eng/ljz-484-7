import { Router } from 'express';
import {
  listStories,
  getStory,
  createStory,
  replaceStory,
  deleteStory,
  newId
} from '../storage.js';
import { validateStory } from '../validation.js';

const router = Router();

// 服务端兜底清洗：只保留白名单字段，防止前端传入脏数据
function sanitizeNode(raw) {
  return {
    id: String(raw.id || newId()),
    type: raw.type === 'ending' ? 'ending' : 'story',
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    choices: Array.isArray(raw.choices)
      ? raw.choices.map((c) => ({
          id: String(c.id || newId()),
          text: String(c.text ?? ''),
          targetNodeId: String(c.targetNodeId ?? '')
        }))
      : []
  };
}

function sanitizeStoryInput(raw = {}) {
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.map(sanitizeNode) : [];
  // 选项 target 可能指向被清洗掉的非法节点，交给 validateStory 报错
  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    startNodeId: typeof raw.startNodeId === 'string' ? raw.startNodeId : '',
    nodes
  };
}

// GET /api/stories —— 故事列表（不含正文，轻量）
router.get('/', (req, res) => {
  res.json(listStories());
});

// POST /api/stories —— 新建故事（自动生成起始节点）
router.post('/', (req, res) => {
  const story = createStory(req.body ?? {});
  res.status(201).json(story);
});

// GET /api/stories/:id —— 故事完整内容（含全部节点和选项关系）
router.get('/:id', (req, res) => {
  const story = getStory(req.params.id);
  if (!story) return res.status(404).json({ error: '故事不存在' });
  res.json(story);
});

// PUT /api/stories/:id —— 保存整个故事的节点关系
// 保存前做完整校验；有硬错误时返回 422，且不落盘
router.put('/:id', (req, res) => {
  if (!getStory(req.params.id)) return res.status(404).json({ error: '故事不存在' });
  const input = sanitizeStoryInput(req.body);
  const candidate = { ...input, id: req.params.id };
  const result = validateStory(candidate);
  if (!result.valid) {
    return res.status(422).json({ error: '故事结构校验未通过', ...result });
  }
  const saved = replaceStory(req.params.id, input);
  res.json({ story: saved, ...result });
});

// DELETE /api/stories/:id
router.delete('/:id', (req, res) => {
  const ok = deleteStory(req.params.id);
  if (!ok) return res.status(404).json({ error: '故事不存在' });
  res.status(204).end();
});

// POST /api/stories/:id/validate —— 只校验不保存（前端点“检查”时用）
router.post('/:id/validate', (req, res) => {
  if (!getStory(req.params.id)) return res.status(404).json({ error: '故事不存在' });
  const input = sanitizeStoryInput(req.body);
  res.json(validateStory({ ...input, id: req.params.id }));
});

export default router;
