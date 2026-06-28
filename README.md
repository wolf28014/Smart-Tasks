# 智能待办 TodoList

参考 [tate233/todolist](https://github.com/tate233/todolist) 构建的功能完整的智能待办 Web 应用。

## 技术栈

- **框架**：Next.js 16 (App Router) + TypeScript 5
- **样式**：Tailwind CSS 4 + shadcn/ui (New York)
- **数据库**：Prisma ORM + SQLite
- **拖拽**：@dnd-kit
- **图表**：Recharts
- **动画**：Framer Motion
- **主题**：next-themes
- **Markdown**：react-markdown

## 核心功能

### 7 种视图
- **列表视图** — 任务卡片网格 + TF-IDF 全文搜索 + 按标签分组
- **看板视图** — 4 列拖拽切换状态（todo / in_progress / done / cancelled）
- **甘特图视图** — 时间轴 + 任务条 + 缩放平移
- **日历视图** — 月历按状态显示任务圆点
- **仪表盘** — 8 统计卡片 + 趋势图 + 状态饼图 + 优先级柱状图 + 番茄钟历史 + 热门标签
- **笔记图谱** — 力导向图可视化任务关联
- **回收站** — 软删除 + 30 天自动清理 + 单条/批量恢复

### 任务模型
- 标题、描述、截止日期
- 优先级（低/中/高）
- 状态机（todo → in_progress → done / cancelled）
- 重复任务（每天/每周/每月）
- 标签
- 子任务（含截止时间 + 拖拽排序）
- 前置依赖（标记 done 前会校验）
- 番茄钟计数
- Markdown 笔记（支持 `[[任务标题]]` 双向关联）

### 其他特性
- **TF-IDF 全文搜索**：中英文混合分词，关键词高亮
- **番茄钟**：25 分钟专注 + 5 分钟休息，浏览器通知
- **Markdown 笔记**：编辑/预览双 Tab，wikilink 自动补全
- **回收站**：软删除机制，30 天自动清理
- **数据导入导出**：JSON（可恢复）/ CSV（Excel 可查看）
- **PWA 离线**：可添加到主屏幕
- **自定义背景**：5 个预设纯色 + 图片上传（限 5MB）
- **暗黑模式**：一键切换
- **响应式设计**：手机/平板/桌面全适配

## 快速开始

### 环境要求

- Node.js ≥ 20
- Bun（推荐）或 npm / pnpm / yarn

### 安装

```bash
# 1. 安装依赖
bun install

# 2. 初始化数据库（重要！会自动创建 SQLite 文件）
bun run db:push

# 3. 启动开发服务器
bun run dev
```

打开 http://localhost:3000 即可使用，首次访问会自动注入 12 条示例任务。

> 💡 **不需要手动创建 `.env` 文件** —— 默认使用 `prisma/db/custom.db`，开箱即用。
> 如需自定义路径，运行 `cp .env.example .env` 后编辑。

### 🪟 Windows 用户：一键启动脚本

仓库自带了 Windows 启动脚本，**双击即可运行**，无需手动输入命令：

#### 日常使用

| 脚本 | 作用 | 使用方式 |
|------|------|---------|
| `scripts/start.bat` | 前台启动（带终端输出，便于排查） | 双击 |
| `scripts/stop.bat` | 停止服务器 | 双击 |
| `scripts/start-silent.vbs` | 后台静默启动（无窗口） | 双击 / 计划任务调用 |

#### 开机自启配置（一次配置，永久生效）

| 脚本 | 作用 | 使用方式 |
|------|------|---------|
| `scripts/install-autostart.bat` | **注册开机自启** | 双击（建议右键管理员身份运行） |
| `scripts/uninstall-autostart.bat` | 取消开机自启 | 双击 |

**配置步骤**：

1. 右键 `scripts/install-autostart.bat` → **以管理员身份运行**
2. 脚本会自动注册 Windows 计划任务 `TodoListAutoStart`
3. 提示是否立即启动，按 `Y` 启动
4. 完成 ✅

之后每次开机登录后，dev server 会在后台自动启动（无窗口），直接浏览器访问 http://localhost:3000 即可。

**查看日志**：后台启动的日志写入 `dev.log` 文件，可随时查看排查问题。

**取消自启**：双击 `scripts/uninstall-autostart.bat` 即可。

> 💡 工作原理：
> - `install-autostart.bat` 调用 `schtasks` 注册计划任务，触发时机为 `onlogon`（用户登录时）
> - 触发后调用 `wscript.exe start-silent.vbs`
> - VBS 用 `WshShell.Run cmd, 0, False` 启动 next dev，参数 `0` 表示隐藏窗口
> - 输出重定向到 `dev.log`，便于排查

### 可用命令

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动开发服务器（端口 3000） |
| `bun run build` | 构建生产版本 |
| `bun run start` | 启动生产服务器 |
| `bun run lint` | 运行 ESLint 检查 |
| `bun run db:push` | 同步 Prisma schema 到数据库 |
| `bun run db:generate` | 重新生成 Prisma Client |
| `bun run db:reset` | 重置数据库 |

## 🔧 故障排查

### 页面显示"加载失败"

**步骤 1**：访问 http://localhost:3000/api/health 查看诊断信息

返回示例（正常）：
```json
{ "ok": true, "database": { "connected": true, ... } }
```

返回示例（异常）：
```json
{
  "ok": false,
  "database": {
    "connected": false,
    "error": "The table `main.Task` does not exist...",
    "hint": "请确认已运行 `bun run db:push`..."
  }
}
```

**步骤 2**：根据诊断结果修复

| 错误信息 | 解决方案 |
|---------|---------|
| `Table does not exist` | 运行 `bun run db:push` 初始化表 |
| `no such table: Task` | 同上 |
| `Cannot find module '@prisma/client'` | 运行 `bun install` |
| `PrismaClientInitializationError` | 检查 `.env` 文件路径是否正确 |
| `Environment variable not found: DATABASE_URL` | 创建 `.env` 文件，或忽略（有默认值） |

**步骤 3**：重新生成 Prisma Client（修改 schema 后必做）

```bash
bun run db:generate
# 然后重启 dev server
```

### 完全重置

```bash
# 删除数据库重新开始
rm -f prisma/db/custom.db db/custom.db
bun run db:push
# 重启 dev server，会自动 seed 示例数据
```

## 项目结构

```
├── prisma/
│   └── schema.prisma              # Task + PomodoroSession 数据模型
├── public/
│   ├── manifest.json              # PWA 清单
│   └── sw.js                      # Service Worker
├── src/
│   ├── app/
│   │   ├── page.tsx               # 主页面（7 视图切换）
│   │   ├── layout.tsx             # 根布局
│   │   └── api/                   # API 路由
│   │       ├── tasks/             # 任务 CRUD + 状态机 + 回收站
│   │       ├── pomodoro/sessions/ # 番茄钟会话
│   │       └── settings/background/ # 背景图上传
│   ├── components/
│   │   ├── todolist/              # 业务组件
│   │   ├── ui/                    # shadcn/ui 组件
│   │   ├── theme-provider.tsx
│   │   └── sw-register.tsx
│   ├── lib/
│   │   ├── db.ts                  # Prisma Client
│   │   ├── task-utils.ts          # 常量、状态机、TF-IDF、wikilink
│   │   └── task-serializer.ts
│   └── hooks/
└── .env.example
```

## 部署

### Vercel
1. Fork 此仓库
2. 在 Vercel 导入
3. 注意：Vercel 不支持 SQLite 持久化，需改用 PostgreSQL。修改 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 自建服务器
```bash
bun run build
bun run start
```

## 许可证

MIT
