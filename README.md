# my-pi-packages

私人 pi-coding-agent skills 和 extensions 同步仓库。

## 安装

```bash
pi install git:github.com:YOUR_USERNAME/my-pi-packages
```

## 更新

```bash
pi update --extensions
```

## 结构

```
├── skills/          # Agent Skills（每个目录含 SKILL.md）
│   ├── github/      # GitHub 操作（issues、PR、releases 等）
│   └── tavily-search/  # Tavily 网页搜索
├── extensions/      # TypeScript 扩展
│   ├── last30days-agent.ts  # 近30天舆情调研工具
│   └── tavily-search.ts     # Tavily 搜索工具注册
└── package.json     # pi package 声明
```

## 添加新的 skill

```bash
mkdir skills/my-skill
# 在该目录下创建 SKILL.md 及辅助脚本
git add -A && git commit -m "add my-skill"
git push
```

## 添加新的 extension

```bash
# 将 .ts 文件放入 extensions/ 目录
git add extensions/my-extension.ts && git commit -m "add my-extension"
git push
```

## 按设备选择性加载

在 `~/.pi/agent/settings.json` 中可按设备过滤：

```json
{
  "packages": [
    {
      "source": "git:github.com:YOUR_USERNAME/my-pi-packages",
      "extensions": ["+extensions/tavily-search.ts"],
      "skills": ["+skills/github"]
    }
  ]
}
```
