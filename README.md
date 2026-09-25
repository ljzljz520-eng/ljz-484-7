# 互动故事编辑器（Interactive Story Editor）

一个从零搭建的互动故事（分支叙事）创作工具：

- **作者端（编辑视图）**：管理故事标题、节点、正文、选项去向与结局标记，自动保存。
- **读者端（预览视图）**：以读者视角点击选项走完整条路径，右侧实时显示「选择路径」轨迹。
- **后端**：保存节点与选项的关系图，并做结构校验（悬空选项、不可达节点、环路等）。
- **无数据库**：整份故事序列化为一个 JSON 文件落盘（原子写 + 写队列）。

## 目录结构

```
.
├── package.json              # 启动脚本（零第三方依赖）
├── backend/                  # 后端（Node.js 内置 http 模块）
│   ├── data/
│   │   └── story.json        # 运行时生成的故事数据（已 gitignore）
│   └── src/
│       ├── server.js         # HTTP 入口：REST API + 托管前端静态文件
│       ├── model.js          # 故事模型：归一化 / 结构校验 / 统计（路径数、环、可达性）
│       └── store.js          # 文件存储层：JSON 读写、原子写、写操作串行化
└── frontend/                 # 前端（原生 ES Modules，无需构建）
    ├── index.html
    ├── css/style.css
    └── js/
        ├── main.js           # 入口：初始化、标签切换、保存状态灯
        ├── api.js            # 后端接口封装
        ├── state.js          # 内存状态与事件总线
        ├── saver.js          # 自动保存调度（防抖 + 代际序号防乱序覆盖）
        ├── editor.js         # 编辑视图：侧栏列表 / 统计 / 校验 / 节点与选项编辑
        ├── preview.js        # 预览视图：读者走路径 + 路径轨迹
        ├── dom.js            # DOM 辅助
        └── toast.js          # 错误提示
```

## 运行

要求 Node.js >= 18。

```bash
npm start          # 生产方式启动
# 或
npm run dev        # node --watch 热重启
```

打开 http://localhost:4173 即可使用（后端同时托管前端，无需单独起前端服务）。
可用 `PORT=8080 npm start` 修改端口。

## 数据模型

```json
{
  "title": "故事标题",
  "startNodeId": "n_xxx",
  "nodes": [
    {
      "id": "n_xxx",
      "title": "节点标题",
      "body": "展示给读者的正文",
      "isEnding": false,
      "choices": [
        { "id": "c_xxx", "text": "选项文字", "nextNodeId": "n_yyy" }
      ]
    }
  ]
}
```

## REST API

所有写接口返回统一信封 `{ story, validation, stats }`。

| 方法   | 路径                                  | 说明                                   |
| ------ | ------------------------------------- | -------------------------------------- |
| GET    | `/api/story`                          | 读取整份故事（含校验结果与统计）       |
| PUT    | `/api/story`                          | 整体替换故事（用于标题 / 开始节点）    |
| POST   | `/api/nodes`                          | 新建节点，返回体额外带 `node`          |
| PATCH  | `/api/nodes/:id`                      | 修改标题 / 正文 / 结局标记 / 选项数组  |
| DELETE | `/api/nodes/:id`                      | 删除节点，并清理指向它的选项           |
| POST   | `/api/nodes/:id/choices`              | 新增选项，返回体额外带 `choice`        |
| PATCH  | `/api/nodes/:id/choices/:cid`         | 修改选项文字 / 去向                   |
| DELETE | `/api/nodes/:id/choices/:cid`         | 删除选项                               |

## 行为说明

- **自动保存**：正文等输入防抖 700ms 后 PATCH；增删节点/选项等结构变更立即保存。
  请求按「代际序号」串行管理，过期响应会被丢弃，避免慢请求覆盖最新内容。
- **结构校验**：未设开始节点、选项未连去向或指向已删节点为错误；
  空标题/空正文、非结局无选项、不可达节点、存在环路为提示。
- **路径统计**：用记忆化 DFS 统计从起点到结局的不同选择路径数（环上不重复计数，
  超过 10000 条显示为 `10000+`）。
