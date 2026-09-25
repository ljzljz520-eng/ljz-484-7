// 故事结构校验：返回 errors（阻塞保存的问题）和 warnings（提示但不阻塞）
export function validateStory(story) {
  const errors = [];
  const warnings = [];
  const nodes = Array.isArray(story.nodes) ? story.nodes : [];
  const ids = new Set();

  for (const node of nodes) {
    if (!node.id) {
      errors.push('存在没有 id 的节点');
      continue;
    }
    if (ids.has(node.id)) errors.push(`节点 id 重复：${node.id}`);
    ids.add(node.id);

    if (!['story', 'ending'].includes(node.type)) {
      errors.push(`节点「${node.title || node.id}」类型无效（必须是 story 或 ending）`);
    }
    if (node.type === 'ending' && (node.choices?.length ?? 0) > 0) {
      warnings.push(`结局节点「${node.title || node.id}」不应包含选项`);
    }
    if (node.type === 'story' && (node.choices?.length ?? 0) === 0) {
      warnings.push(`故事节点「${node.title || node.id}」没有任何选项，读者会卡死`);
    }
    for (const choice of node.choices ?? []) {
      if (!choice.text?.trim()) {
        errors.push(`节点「${node.title || node.id}」有空文本的选项`);
      }
      if (!choice.targetNodeId) {
        errors.push(`节点「${node.title || node.id}」的选项「${choice.text || '(空)'}」未选择目标节点`);
      } else if (!nodes.some((n) => n.id === choice.targetNodeId)) {
        errors.push(
          `节点「${node.title || node.id}」的选项「${choice.text || '(空)'}」指向不存在的节点`
        );
      }
    }
  }

  if (!story.startNodeId) {
    errors.push('没有设置起始节点');
  } else if (!ids.has(story.startNodeId)) {
    errors.push('起始节点不存在或已被删除');
  }

  // 可达性：从起始节点遍历，找出读者永远走不到的节点
  if (story.startNodeId && ids.has(story.startNodeId)) {
    const seen = new Set([story.startNodeId]);
    const queue = [story.startNodeId];
    while (queue.length) {
      const cur = nodes.find((n) => n.id === queue.shift());
      for (const c of cur?.choices ?? []) {
        if (c.targetNodeId && ids.has(c.targetNodeId) && !seen.has(c.targetNodeId)) {
          seen.add(c.targetNodeId);
          queue.push(c.targetNodeId);
        }
      }
    }
    for (const n of nodes) {
      if (!seen.has(n.id)) warnings.push(`节点「${n.title || n.id}」从起点不可达`);
    }
  }

  if (!nodes.some((n) => n.type === 'ending')) {
    warnings.push('整个故事没有任何结局节点');
  }

  return { valid: errors.length === 0, errors, warnings };
}
