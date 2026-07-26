# my-pi-packages

私人 pi-coding-agent 仓库。跨设备同步自建 skills/extensions，同时收纳好用的第三方资源。

## 结构

```
├── self/                    # 自建内容（你维护）
│   ├── skills/
│   │   ├── github/          # GitHub 操作（gh CLI）
│   │   └── tavily-search/   # Tavily 网页搜索
│   └── extensions/
│       ├── tavily-search.ts        # Tavily 搜索工具注册
│       └── last30days-agent.ts     # last30days 调研子 agent
├── vendored/                # 第三方资源（本地维护副本）
│   ├── skills/              # 放入无法 pi install 的第三方 skill
│   └── extensions/          # 放入无法 pi install 的第三方 extension
├── package.json
├── README.md
└── AGENTS.md
```

## 安装

```bash
# 本仓库
pi install git:github.com/yuanbaoerer/my-pi-packages

# 配套第三方包（需单独安装）
pi install git:github.com/mvanhorn/last30days-skill
```

## 添加资源

**自建 skill/extension** → 放入 `self/` 对应目录

**第三方 skill/extension**：
- 能 `pi install` → 单独安装，**不放入本仓库**
- 不能 `pi install` → 放入 `vendored/` 对应目录

## 日常同步

```bash
cd ~/my-pi-packages
git add -A && git commit -m "..."
git push

# 其他设备
pi update --extensions
# 在 pi 里 /reload
```
