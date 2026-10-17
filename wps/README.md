# WPS 每日签到

将原本的 Surge 本地模块托管为远程模块。保留原 MITM 域名、Cookie 匹配规则和上游签到脚本；Cookie 获取使用本仓库带 BoxJS 开关的 Surge 脚本，定时任务调整为每天设备本地时间 10:00，签到任务超时仍为 120 秒。策略组页面新增手动测试面板；手动入口加载同一上游脚本并显示它的任务汇总，不修改上游任务逻辑。

## 安装

在 Surge 模块管理中通过 URL 安装并启用：

```text
https://raw.githubusercontent.com/Tizzy-3/Surge/main/wps/WPS.sgmodule
```

如果已经安装原本的 WPS 本地模块，请用此远程模块替换，保持只启用一份，避免重复捕获和定时运行。

## 获取 Cookie 与运行

1. 添加下面的「WPS 获取开关」BoxJS 订阅，进入「WPS Cookie 获取开关」，打开「允许获取 Cookie」（默认关闭）。确认 Surge 正在接管流量，MITM 已开启，证书已经安装并信任。
2. 打开已登录的 WPS App，进入任务中心、福利中心等活动页面，触发 `page_info` 请求。
3. 获取脚本会保存兼容原作者的 `wps_sid` 并通知结果。成功后，在 BoxJS 手动关闭「允许获取 Cookie」；关闭不会清除已有 Cookie，不影响定时签到或手动测试。
4. 每天设备本地时间 **10:00** 运行，启用 `wake-system=true`，总超时为 120 秒。

从本地模块换成远程模块不会改动凭证键 `wps_sid`；如果之前已在同一个 Surge 中捕获，模块可以继续使用这份设备本地数据。

## BoxJS 获取开关

在 BoxJS「订阅」中添加：

```text
https://raw.githubusercontent.com/Tizzy-3/Surge/main/wps/boxjs.json
```

打开应用「WPS Cookie 获取开关」可控制「允许获取 Cookie」，默认关闭。已有 Cookie 无需重新获取；失效后再打开开关、进入 WPS 活动页获取，成功后手动关闭。此开关仅阻止脚本保存新 Cookie 和发获取通知，MITM 域名及匹配规则仍保留。

此订阅只增加获取开关，不替代原作者的 WPS 任务设置。原作者 [Paperclip 订阅](https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/paperclip.boxjs.json) 可继续管理签到、福利任务、调试和 `wps_sid`；两份订阅可以同时使用。新订阅不写入或清空 `wps_sid`。

如果尚未安装 BoxJS，请先安装 [BoxJS 官方 Surge 模块](https://raw.githubusercontent.com/chavyleung/scripts/master/box/rewrite/boxjs.rewrite.surge.sgmodule)，再访问 <http://boxjs.com>。

## 策略组页手动测试

1. 更新并启用本模块，打开 Surge 的策略组选择页面。
2. 找到「**WPS · 手动测试**」面板，点击它右上角的刷新按钮。
3. 面板下载原作者的 `wps.js`，直接运行一次，并将它的通知内容显示为「WPS · 任务结果」。系统 WPS 通知也会保留。
4. 手动运行的日志属于 `WPS_Manual_Test`；每天 10:00 自动运行的日志属于 `WPS签到`。请以面板、通知中各项任务的真实结果为准。

仅打开策略组页面、自动刷新面板或缺少 Cookie 时，不会执行 WPS 任务。请等待当前执行完成后再点击。手动入口使用 WebView 引擎，总超时为 150 秒，面板在 140 秒未结束时显示超时；原脚本下载失败或执行结果不明时，面板不会自动重跑。上游脚本自带的请求重试逻辑保持原样。信息面板需要 Surge 对应的功能授权。

此面板使用本仓库的 `wps.panel.js`，实际签到仍由原作者 `wps.js` 负责；Cookie 获取改为本仓库 `wps.cookie.capture.js`，以支持独立开关。设备本地凭证键 `wps_sid` 保持不变。

自动任务安排在每天 10:00，以配合上游福利活动的开放时间；上游任务逻辑和任务开关保持原样。

旧入口只检查定时执行接口的回调，空回调无法说明业务结果。当前入口不依赖该接口，而是等待原脚本 `$done`，收集它通过 `$notification.post` 发出的实际结果。面板行为依据：[官方信息面板](https://manual.nssurge.com/tools/panel.html)、[Surge 脚本 API](https://manual.nssurge.com/scripting/api.html)。

## 本地检查

```sh
node --check wps/wps.cookie.capture.js
node --test tests/capture-switches.test.cjs
node --check wps/wps.panel.js
node --test wps/tests/wps-panel.test.cjs
```

测试使用模拟 Surge HTTP、通知和存储，不会发起真实签到、抽奖或账号请求。

可将上述原作者脚本下载至本地后设置 `WPS_UPSTREAM_FIXTURE` 为其绝对路径，再运行测试。额外三个集成用例使用未修改的原脚本，模拟「已签到」「Cookie 失效」「任务全部关闭」的响应，验证原脚本通知可显示在面板；未设置时会明确跳过这三个用例。它们不等同于 Surge 手机实测。

## 上游与范围

- 原作者：[MaYIHEI/paperclip](https://github.com/MaYIHEI/paperclip)
- [Cookie 捕获脚本](https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/app/wps/wps.cookie.js)
- [WPS 签到脚本](https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/app/wps/wps.js)

本仓库托管模块、手动测试面板、Cookie 获取开关及相应捕获脚本。签到主脚本仍由 Surge 从上述原作者地址加载和更新；捕获脚本沿用原作者文档中的请求匹配及 `wps_sid` 存储约定，仅支持 Surge。当前上游签到脚本还包含福利中心、抽奖、试用申请等任务，本次没有调整这些任务或其默认开关。

已对手动入口执行离线模拟检查；没有执行真实 WPS 签到或验证手机界面和账号状态。
