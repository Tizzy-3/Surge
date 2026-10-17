# WPS 每日签到

将原本的 Surge 本地模块托管为远程模块。保留原 MITM 域名、Cookie 捕获规则和上游脚本，定时任务调整为每天设备本地时间 10:00，签到任务超时仍为 120 秒。策略组页面新增手动测试面板；不复制或修改上游脚本。

## 安装

在 Surge 模块管理中通过 URL 安装并启用：

```text
https://raw.githubusercontent.com/Tizzy-3/Surge/main/wps/WPS.sgmodule
```

如果已经安装原本的 WPS 本地模块，请用此远程模块替换，保持只启用一份，避免重复捕获和定时运行。

## 获取 Cookie 与运行

1. 确认 Surge 正在接管流量，MITM 已开启，证书已经安装并信任。
2. 打开已登录的 WPS App，进入任务中心、福利中心等活动页面，触发 `page_info` 请求。
3. 上游捕获脚本会保存 `wps_sid` 并通知 Cookie 获取结果。
4. 每天设备本地时间 **10:00** 运行，启用 `wake-system=true`，总超时为 120 秒。

从本地模块换成远程模块不会改动凭证键 `wps_sid`；如果之前已在同一个 Surge 中捕获，模块可以继续使用这份设备本地数据。

## 策略组页手动测试

1. 更新并启用本模块，打开 Surge 的策略组选择页面。
2. 找到「**WPS · 手动测试**」面板，点击它右上角的刷新按钮。
3. 面板通过 Surge 官方 `$httpAPI` 调用 `/v1/scripting/cron/evaluate`，只调用一次本模块中的 `WPS签到` 任务；不需要自行配置 HTTP API 监听端口或密钥。
4. 查看 WPS 原脚本的「WPS 任务汇总」通知及 `WPS签到` 脚本日志。面板只报告执行接口返回情况，不把接口返回当成各业务任务签到成功。

仅打开策略组页面、自动刷新面板或缺少 Cookie 时，不会执行 WPS 任务。请等待当前执行完成后再点击。手动入口超时为 150 秒，给原本 120 秒的签到任务留出接口调用时间。信息面板需要 Surge 对应的功能授权。

此面板使用本仓库的 `wps.panel.js`，签到和 Cookie 捕获仍由原作者脚本负责。设备本地凭证键 `wps_sid` 保持不变。

自动任务安排在每天 10:00，以配合上游福利活动的开放时间；上游任务逻辑和任务开关保持原样。

接口依据：[官方信息面板](https://manual.nssurge.com/tools/panel.html)、[官方定时脚本执行接口](https://manual.nssurge.com/tools/http-api.html)、[脚本内调用 HTTP API](https://manual.nssurge.com/scripting/api.html)。

## 本地检查

```sh
node --check wps/wps.panel.js
node --test wps/tests/wps-panel.test.cjs
```

测试使用模拟 Surge API，不会发起真实签到、抽奖或账号请求。

## 上游与范围

- 原作者：[MaYIHEI/paperclip](https://github.com/MaYIHEI/paperclip)
- [Cookie 捕获脚本](https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/app/wps/wps.cookie.js)
- [WPS 签到脚本](https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/app/wps/wps.js)

本仓库托管模块与手动测试面板；签到及 Cookie 捕获脚本仍由 Surge 从上述原作者地址加载和更新。当前上游签到脚本还包含福利中心、抽奖、试用申请等任务，本次没有调整这些任务或其默认开关。

已对手动入口执行离线模拟检查；没有执行真实 WPS 签到或验证手机界面和账号状态。
