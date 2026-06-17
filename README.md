# 考研专注（kaoyan-focus）

考研复习专注助手 —— 用 AI 驱动的番茄钟 + RAG 知识库对抗拖延症，让每一分钟都算数。

## 功能概览

- **🎯 任务管理**：创建今日复习任务，支持科目分类和优先级排序
- **⏱️ 专注计时器**：番茄钟专注模式，记录每个任务的专注时长
- **🐱 Lulu AI 伙伴**：虚拟学习伙伴实时反馈你的专注状态，拖延时会收到提醒
- **💬 AI 对话问答**：接入教材知识库的 RAG 问答，支持多模型切换
- **📊 学习统计**：每日/每周学习数据可视化，追踪各科目投入
- **📝 作业追踪**：管理课后作业和习题进度
- **📓 电子笔记本**：记录学习笔记和心得
- **📚 教材知识库**：内置考研 408 教材（数据结构、计算机组成原理），支持教材内容检索与问答
- **🌙 深色模式**：支持亮色/深色主题切换
- **🔌 多模型支持**：OpenAI / DeepSeek / 通义千问 / 智谱 GLM / Moonshot

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 + Framer Motion |
| 构建 | Vite 6 |
| 后端 | Express 5 + TypeScript (tsx) |
| 数据库 | SQLite (better-sqlite3) |
| AI | 多提供商兼容 OpenAI 接口格式 |
| 数学渲染 | KaTeX |
| 图标 | Lucide React |

## 快速开始

### 前置要求

- Node.js 18+
- npm

### 安装与运行

```bash
# 安装依赖
npm install

# 启动后端服务器（端口 3001）
npm run server

# 启动前端开发服务器（端口 5173）
npm run dev
```

打开浏览器访问 `http://localhost:5173`。

### 配置 AI 模型

在应用内点击右上角 ⚙️ 设置按钮，填入你的 API Key 并选择模型提供商。

## 项目结构

```
├── src/                  # React 前端
│   ├── components/       # UI 组件
│   │   ├── FocusTimer.tsx     # 专注计时器
│   │   ├── Lulu.tsx           # Lulu 虚拟伙伴
│   │   ├── LuluChat.tsx       # AI 对话面板
│   │   ├── Workspace.tsx      # 工作区
│   │   ├── Sidebar.tsx        # 侧边栏导航
│   │   ├── StatsPanel.tsx     # 统计面板
│   │   ├── HomeworkTracker.tsx # 作业追踪
│   │   ├── HomeworkModal.tsx  # 作业详情弹窗
│   │   └── NotebookModal.tsx  # 笔记本弹窗
│   ├── App.tsx           # 应用主入口
│   └── main.tsx          # React 挂载
├── server/               # Express 后端
│   ├── routes/           # API 路由（tasks, records, homework, notebook, chat）
│   ├── rag_pipeline/     # RAG 检索增强生成
│   │   ├── textbookLoader.ts  # 教材加载与分块
│   │   ├── retrieval.ts       # 检索逻辑
│   │   ├── promptBuilder.ts   # 提示词构建
│   │   ├── factLock.ts        # 事实锁定
│   │   ├── questionParser.ts  # 问题解析
│   │   └── types.ts
│   ├── data/             # 数据库和问答数据
│   └── assets/教材库/     # 考研教材文本
└── vite.config.ts
```

## 许可证

MIT
