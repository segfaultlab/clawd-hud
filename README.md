# clawd-hud

Claude Code 的 mod：在输入框上方显示一行像素风用量条，带一只会跟着状态做动作的像素 Clawd。

![用量条](docs/band.svg)

![Clawd 的动作](docs/poses.svg)

- 上下文、5 小时额度、本周额度的格子进度条
- 5 小时额度的消耗速度，以及能不能撑到重置
- 本会话花费、上一轮的耗时、输出 token 和缓存命中率
- Clawd 跟着 Claude 的状态做动作：思考冒 `?`、调用工具敲锤子、写文件拿笔写字、读文件和搜索捧书看（读完想下一步时也继续捧着）、等你批准时举手、压缩上下文揉纸团、子代理干活时脚边跟着小 Clawd、有后台命令时脚边亮着小终端、写回复飘字、出错晕倒、中断摔倒、空闲睡觉、额度快用完时冒汗发抖、用完躺平

只在本地读取 Claude Code 已有的用量数据，不额外消耗 token。

Clawd 和动画只在 Claude 桌面端的 Code 页面显示；终端里显示的是文字版进度条。

## 安装

```bash
claude plugin marketplace add segfaultlab/clawd-hud
claude plugin install clawd-hud@clawd-hud
```

装好后新开一个会话就生效。

## 更新

建议打开自动更新：在终端里运行 `claude`，输入 `/plugin`，进入 Marketplaces，选中 clawd-hud，打开自动更新。之后有新版本时 Claude Code 会自己拉取，重启会话后生效。

不开自动更新的话，手动执行：

```bash
claude plugin marketplace update clawd-hud
claude plugin update clawd-hud@clawd-hud
```

5h 和 wk 两条来自订阅账号的额度数据，用 API key 登录时只显示 ctx。

## 本地开发

改代码时直接加载源码目录，不用安装：

```bash
claude --plugin-dir /path/to/clawd-hud
```

这时先在 `/plugin` 里停用已安装的 clawd-hud，否则会出现两条横条。终端会话会监视这个目录，保存后自动重新加载。

插件没有写版本号，每次提交到 GitHub 都算一个新版本。

改了画图代码后重新生成 README 里的图：

```bash
node scripts/preview.ts
```

## 文件

- `hooks/register.tsx`：事件钩子，读取用量、跟踪状态
- `hooks/draw.ts`：生成横条的 SVG（像素 Clawd、进度条、动画）
- `types/index.d.ts`：mod 保存的状态类型
- `scripts/preview.ts`：生成 `docs/` 下的效果图
