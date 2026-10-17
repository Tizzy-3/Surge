# WPS 每日签到

将原本的 Surge 本地模块托管为远程模块。保留用户提供的配置、MITM 域名、Cookie 捕获规则、每天 10:00 的定时任务和 120 秒超时；不复制或修改上游脚本。

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

## 上游与范围

- 原作者：[MaYIHEI/paperclip](https://github.com/MaYIHEI/paperclip)
- [Cookie 捕获脚本](https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/app/wps/wps.cookie.js)
- [WPS 签到脚本](https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/app/wps/wps.js)

本仓库只托管模块文件，脚本仍由 Surge 从上述原作者地址加载和更新。当前上游签到脚本还包含福利中心、抽奖、试用申请等任务，本次没有调整这些任务或其默认开关。

本次只检查模块配置和上游资源能否访问，没有执行真实 WPS 签到或验证账号状态。
