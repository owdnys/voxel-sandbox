# 方块漫游 · 创造世界（voxel-sandbox）

一个纯前端的浏览器体素沙盒（Minecraft 风格的挖掘 / 建造小游戏），使用 **three.js + TypeScript + Vite** 构建。
没有后端、没有数据库、没有外部资源依赖，**构建出来的 `dist/` 就是完整可玩的网站**，可以直接丢到任意静态托管上。

- 桌面端：鼠标锁定视角、WASD 移动、空格跳跃、左键挖、右键放、数字键 / 滚轮切物品栏
- 手机端：虚拟摇杆、触摸转向、挖掘 / 放置 / 跳跃按钮
- 世界：程序化地形（simplex 噪声）、水体、区块按需生成；破坏与建造会实时重建相邻区块
- 存档：自动保存到浏览器 `localStorage`，可重置世界并换随机种子
- 物品栏 / 暂停菜单 / 帮助面板，界面为玻璃拟态风格

---

## 一、本地跑起来

需要 Node.js 18 以上（推荐 20 / 22）。

```bash
npm install          # 安装依赖
npm run dev          # 开发模式，默认 http://localhost:5173/
npm run build        # 生产构建，产物在 dist/
npm run preview      # 本地预览构建产物
npm test             # 端到端冒烟测试（需要本机装有 Microsoft Edge）
```

## 二、部署（两条免费路线，可任选其一，也可同时开）

两份方案用的是同一个 `vite.config.ts`，其中 `base: './'` 已把资源路径改成相对路径，
因此**同一份构建产物既能跑在根路径，也能跑在仓库子路径**，不需要为不同平台改代码。

### 方案 A：GitHub Pages（`https://<你的用户名>.github.io/<仓库名>/`）

仓库里已经放好了工作流 `.github/workflows/deploy.yml`，推代码即自动构建发布。

1. 在 GitHub 上新建一个仓库（Public 最省事；Private 也可以，Pages 对私有仓库的支持取决于账号方案）。
2. 把本目录的代码上传上去（见下面第三节）。
3. 打开仓库 **Settings → Pages**，把 **Build and deployment → Source** 选成 **GitHub Actions**。
4. 回到仓库 **Actions** 页，等 `Deploy to GitHub Pages` 跑完（首次约 1 分钟）。
5. 访问 `https://<你的用户名>.github.io/<仓库名>/`。

> 如果默认分支叫 `main` 或 `master` 都能触发；也可以是手动 **Actions → Run workflow**。

### 方案 B：Cloudflare Pages（`https://<项目名>.pages.dev`，免费域名）

**B-1 连接 Git 仓库自动构建（推荐，push 后自动重新部署）**

1. 打开 Cloudflare 控制台 → **Workers & Pages → Create application → Pages → Connect to Git**，
   授权 GitHub 并选中刚推上去的仓库。
2. 在 **Set up builds and deployments** 这一步填：

   | 选项 | 填什么 |
   | --- | --- |
   | Project name | `voxel-sandbox`（决定网址 `voxel-sandbox.pages.dev`） |
   | Production branch | `main` |
   | Framework preset | `Vite` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

   再展开 **Environment variables (optional)**，加一条：

   | 变量名 | 值 | 为什么 |
   | --- | --- | --- |
   | `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | `1` | 不加的话构建时会去下载 Playwright 的浏览器（几百 MB），又慢又容易失败；本游戏构建根本用不到它 |
   | `NODE_VERSION`（可选） | `22` | 指定 Node 版本，避免撞上过旧的默认版本 |

3. 点 **Save and Deploy**，等构建跑完，用 `https://<项目名>.pages.dev` 访问。

> ⚠️ Cloudflare 的规则：项目**一旦用 Git 集成创建，就不能再改成 Direct Upload 类型**。
> 所以先想好走哪条：Git 集成＝push 即自动更新；Direct Upload＝每次手动传。

**B-2 不接仓库，直接上传 `dist/`（最省事）**

```bash
npm run build
npx wrangler pages deploy dist --project-name=voxel-sandbox
```

或者在面板里选 **Pages → Upload assets**，把 `dist` 文件夹整个拖进去。
这条路不需要 Git 集成，改完代码重新 build + 上传即可。

### 关于「免费域名」和两个平台的关系

- 两份方案**可以同时开，互不干扰**：同一个仓库既能有 `github.io` 网址，也能有 `pages.dev` 网址，
  两个网址都能玩，存档各自独立（`localStorage` 按域名隔离）。
- 留意一点：如果你走的是 Cloudflare 路线而没在 GitHub 仓库里启用 Pages，
  那么 push 后 `Deploy to GitHub Pages` 那个工作流会因为「仓库未启用 Pages」而报错（红叉）。
  去 **Settings → Pages → Source** 选一次 **GitHub Actions** 它就会变绿，顺带多一个免费网址；
  完全不想用也可以，在 **Settings → Actions** 里把它禁用即可。

## 三、代码怎么传到 GitHub

**方式一：GitHub Desktop（图形界面，最不容易出错）**

1. 安装 GitHub Desktop → `File → Add local repository` → 选择本目录 → `create a repository`。
2. 确认 `.gitignore` 生效（`node_modules/`、`dist/` 不会上传），点 **Publish repository**。

**方式二：命令行**

```bash
git init
git add .
git commit -m "Initial commit: voxel sandbox"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> 上传时最容易出错的地方：**一定要把整个文件夹连子目录一起传**。
> `src/`、`.github/` 这类文件夹一旦漏掉，网站就会白屏或无法自动部署。
> 用 GitHub Desktop 的 **Add local repository** 最稳妥；用网页拖拽上传时，
> 要确认上传列表里能看到 `src/` 和 `.github/` 两层文件夹再点提交。

## 四、目录结构

```
voxel-sandbox/
├─ index.html              # 唯一 HTML 入口
├─ vite.config.ts          # 构建配置（相对 base，供各类静态托管使用）
├─ tsconfig.json
├─ src/
│  ├─ main.ts              # 初始化、渲染循环、UI 与输入
│  ├─ world.ts             # 体素世界、地形生成、区块网格、存档读写
│  ├─ player.ts            # 玩家物理、碰撞、射线拾取
│  ├─ blocks.ts            # 方块定义
│  ├─ textures.ts          # 用 Canvas 程序化生成方块贴图（无图片素材）
│  └─ style.css            # 全部界面样式
├─ tests/smoke.mjs         # Playwright 冒烟测试（桌面 + 手机）
└─ .github/workflows/deploy.yml   # GitHub Pages 自动部署
```

## 五、常见问题

- **页面白屏、资源 404**：几乎都是 `base` 没设成相对路径导致的子路径问题。
  本仓库已通过 `vite.config.ts` 的 `base: './'` 解决，请勿删掉。
- **国内访问慢或打不开**：`github.io` 与 `pages.dev` 在国内网络下都可能不稳定，
  这是网络环境问题，不是项目问题；绑定自己的域名（套 CDN）会明显改善。
- **首屏字体请求**：`src/style.css` 第一行通过 `@import` 引入了 Google Fonts。
  在无法访问 `fonts.googleapis.com` 的网络下，浏览器会等待该请求超时，
  期间页面样式可能延迟生效。如果目标用户主要在国内，建议把这一行删掉或改成本地字体
  （这一步会修改源码，按要求未擅自动手，需要的话可以再让我处理）。
- **换电脑后存档还在吗**：存档在浏览器 `localStorage` 里，和域名绑定；换域名 / 换设备不会带走。
- **`npm ci` 时下载 Playwright 浏览器很慢**：它只用于 `npm test`，
  构建网站本身用不到，可加环境变量 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` 跳过
  （自动部署的工作流里已经这么设了）。
