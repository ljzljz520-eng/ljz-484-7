# 互动故事编辑器

一个从零搭建的互动故事（branching narrative）编辑器：

- **作者端**：管理故事节点、节点正文、选项跳转关系和结局
- **读者端预览**：从起始节点出发，按选项走分支，实时查看已选择的路径并可回退
- **后端**：保存节点关系，提供结构校验（悬空选项、不可达节点、缺起始点等）
- **无数据库**：数据持久化在 `backend/data/stories.json`（原子写入）

## 目录结构（前后端分离，不共用 src）

```
.
├── backend/                # Node.js + Express API
│   ├── src/
│   │   ├── server.js       # Express 入口，生产模式托管 frontend/dist
│   │   ├── storage.js      # JSON 文件存储层 + 示例故事
│   │   ├── validation.js   # 节点关系校验（错误/警告/可达性）
│   │   └── routes/
│   │       └── stories.js  # /api/stories REST 路由 + 入参清洗
│   └── data/stories.json   # 运行后自动生成
├── frontend/               # React + Vite 单页应用
│   ├── index.html
│   ├── vite.config.js      # dev 时 /api 代理到 :4000
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js
│       ├── styles.css
│       └── components/
│           ├── StoryList.jsx
│           ├── Editor.jsx      # 工具栏、节点列表、保存/校验
│           ├── NodeEditor.jsx  # 正文、类型、选项与目标
│           └── Preview.jsx     # 读者视角与选择路径
└── package.json            # 仅含便捷脚本，不含业务代码
```

## 快速开始

需要 Node.js 18+。

```bash
# 1. 安装依赖
npm run install:all

# 2. 启动后端（:4000，--watch 热重载）
npm run dev:backend

# 3. 另开终端启动前端开发服务器（:5173，自动代理 /api）
npm run dev:frontend
```

打开 http://localhost:5173 即可。首次启动后端会自动写入示例故事《迷雾客栈》。

## 生产模式（单端口）

```bash
npm run build:frontend   # 产出 frontend/dist
npm start                # 后端在 :4000 同时托管 API 和静态页面
```

访问 http://localhost:4000。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/stories` | 故事列表（摘要） |
| POST | `/api/stories` | 新建故事（自动生成起始节点） |
| GET | `/api/stories/:id` | 故事全文（含节点与选项关系） |
| PUT | `/api/stories/:id` | 保存故事；结构校验失败返回 422，不落盘 |
| DELETE | `/api/stories/:id` | 删除故事 |
| POST | `/api/stories/:id/validate` | 只校验不保存 |

### 数据模型

```jsonc
{
  "id": "...",
  "title": "故事标题",
  "description": "简介",
  "startNodeId": "n1",
  "nodes": [
    {
      "id": "n1",
      "type": "story",          // story | ending
      "title": "节点标题",
      "body": "正文……",
      "choices": [
        { "id": "c1", "text": "选项文字", "targetNodeId": "n2" }
      ]
    }
  ]
}
```

- `type: "ending"` 的节点为结局，不显示选项，读者抵达即结束
- `story` 节点没有选项会收到「读者会卡死」警告
- 选项指向已删除节点、起始节点缺失等为硬错误，阻止保存

## 设计说明

- **存储**：单 JSON 文件足够当前规模；写入走 `临时文件 + rename`，避免半写损坏；文件损坏会自动备份并重建。
- **校验放后端**：前端的提示仅为体验，真正的结构合法性由 `PUT /api/stories/:id` 把关，返回 422 时旧数据不受影响。
