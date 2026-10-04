# clawd-hud

Claude Code 的 mod：在输入框上方显示一行像素风用量条，带一只会跟着状态做动作的像素 Clawd。

- 上下文、5 小时额度、本周额度的格子进度条
- 5 小时额度的消耗速度和预计用完时间
- Clawd：思考冒 `?`、调用工具敲锤子、写文件拿笔写字、读文件和搜索捧书看、等你批准时举手、压缩上下文揉纸团、子代理干活时脚边跟着小 Clawd、有后台命令时脚边亮着小终端、写回复飘字、出错晕倒、中断摔倒、空闲睡觉、额度用完躺平

只在本地读取 Claude Code 已有的用量数据，不额外消耗 token。

## 加载

```bash
claude --plugin-dir /path/to/clawd-hud
```

桌面端可在 `~/.claude/settings.json` 的 `env` 里设置 `CLAUDE_CODE_PLUGIN_DIRS` 指向本目录。

## 文件

- `hooks/register.tsx`：事件钩子，读取用量、跟踪状态
- `hooks/draw.ts`：生成横条的 SVG（像素 Clawd、进度条、动画）
- `types/index.d.ts`：mod 保存的状态类型
