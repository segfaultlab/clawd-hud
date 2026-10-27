# clawd-hud

Claude Code 桌面端的 mod：在 Code 页面的输入框上方显示一行像素风用量条，带一只会跟着状态做动作的像素 Clawd。

![用量条](docs/band.svg)

![Clawd 的动作](docs/poses.svg)

- 上下文、5 小时额度、本周额度的格子进度条
- 5 小时额度的消耗速度，以及能不能撑到重置
- 本会话花费、上一轮的耗时、输出 token 和缓存命中率
- 横条右端的「用量 ▸」按钮：打开一个面板，列出近 30 天或全部历史的 token 用量（按模型分输入、输出、缓存写入、缓存读取）、按 Claude API 单价折算的费用，以及每日费用柱状图
- Clawd 跟着 Claude 的状态做动作：思考冒 `?`、调用工具敲锤子、写文件拿笔写字、读文件和搜索捧书看（读完想下一步时也继续捧着）、等你批准时举手、压缩上下文揉纸团、子代理干活时脚边跟着小 Clawd、有后台命令时脚边亮着小终端、写回复飘字、出错晕倒、中断摔倒、空闲睡觉、额度快用完时冒汗发抖、用完躺平

只在本地读取 Claude Code 已有的用量数据，不额外消耗 token。

用量面板的数据来自本机 `~/.claude/projects` 下的会话记录（设置了 `CLAUDE_CONFIG_DIR` 时读那个目录），每次打开或点「刷新」时用系统自带的 `sh` 和 `grep` 重新扫一遍，记录多时要几秒。同一条回复在续接的会话里会重复出现，统计时按消息 ID 去重。费用按 `hooks/ledger.ts` 里写死的 API 单价估算，缓存写入按输入价的 2 倍（1 小时缓存）或 1.25 倍（5 分钟缓存）计；订阅用户实际不按这个计费，单价表里没有的模型只算 token 不算钱。网页版 claude.ai 的聊天和其他电脑上的用量不在里面。Windows 上没有 `sh` 和 `grep`，面板会提示读取失败。

只在桌面端的 Code 页面显示，用 SVG 绘制。终端里的 Claude Code 不显示横条，也不弹额度提醒。

## 安装

```bash
claude plugin marketplace add segfaultlab/clawd-hud
claude plugin install clawd-hud@clawd-hud
```

装好后在桌面端新开一个会话就生效。

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

这时先在 `/plugin` 里停用已安装的 clawd-hud，否则会出现两条横条。终端里不显示横条，改完用 `claude plugin test .` 跑测试，用下面的脚本看效果图。

插件没有写版本号，每次提交到 GitHub 都算一个新版本。

改了画图代码后重新生成 README 里的图：

```bash
node scripts/preview.ts
```

## 文件

- `hooks/register.tsx`：事件钩子，读取用量、跟踪状态
- `hooks/draw.ts`：生成横条的 SVG（像素 Clawd、进度条、动画）和用量面板的每日柱状图
- `hooks/ledger.ts`：扫描本地会话记录、去重汇总、按单价折算费用
- `types/index.d.ts`：mod 保存的状态类型
- `scripts/preview.ts`：生成 `docs/` 下的效果图
- `tests/band.test.tsx`：桌面端能画出横条、终端不画的测试，用 `claude plugin test .` 运行
- `tests/usage.test.tsx`：用量扫描、去重、计价和面板的测试
