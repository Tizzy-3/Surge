# Tizzy3 Surge 模块

各功能独立放在子文件夹中，可分别订阅和启用。

| 功能 | 每日运行时间 | 使用说明 |
| --- | --- | --- |
| 每日签到：哈士奇 / IMYAI / 金蝶云社区 | 设备本地时间 07:00 | [daily-signin](daily-signin/README.md) |
| WPS 每日签到 | 设备本地时间 10:00 | [wps](wps/README.md) |

## 每日签到模块

```text
https://raw.githubusercontent.com/Tizzy-3/Surge/main/daily-signin/DailySignIn.sgmodule
```

包含07:00定时任务和策略组页的「每日签到 · 手动测试」面板。凭证捕获由 BoxJS「Surge 每日签到 → 允许获取 Cookie」控制，默认关闭。获取所需凭证后手动关闭开关，定时签到继续运行。

BoxJS 订阅：

```text
https://raw.githubusercontent.com/Tizzy-3/Surge/main/daily-signin/boxjs.json
```

## WPS 模块

```text
https://raw.githubusercontent.com/Tizzy-3/Surge/main/wps/WPS.sgmodule
```

每天10:00定时任务和策略组页「WPS · 手动测试」入口继续运行作者的签到脚本。Cookie 获取由独立的 BoxJS 开关控制，默认关闭；需要时打开、成功后手动关闭。

WPS 获取开关 BoxJS 订阅（与原作者 Paperclip 任务订阅同时使用）：

```text
https://raw.githubusercontent.com/Tizzy-3/Surge/main/wps/boxjs.json
```

更新两份模块及其远程脚本后，再刷新或添加相应 BoxJS 订阅。已有 Cookie/JWT 保留，无需重新获取。开关关闭时只停止脚本保存凭证和获取通知，模块的 MITM 和匹配规则仍保留。

## 从旧地址迁移

原根目录的 `DailySignIn.sgmodule`、脚本、BoxJS、图片及其文档、测试已移入 `daily-signin/`，旧根目录资源地址已停止使用。

1. 用上方的新地址替换旧的每日签到模块，保持只启用一份，避免定时任务重复。
2. 在 BoxJS 中将旧订阅替换为新的 `daily-signin/boxjs.json` 地址。订阅 ID 和设置键不变；此次目录调整不清除 Surge 设备中已有凭证。
3. 用 `wps/WPS.sgmodule` 替换原 WPS 本地模块，保持只启用一份。

## 本地检查

```sh
node --check daily-signin/surge_signin.js
node --check daily-signin/surge_cookie_capture.js
node --test daily-signin/tests/surge.test.cjs
node --check wps/wps.cookie.capture.js
node --test tests/capture-switches.test.cjs
node --check wps/wps.panel.js
node --test wps/tests/wps-panel.test.cjs
```

离线检查不会执行真实签到、抽奖或推送。WPS 上游脚本及其业务结果由原作者维护；本仓库托管其模块入口和手动测试面板。
