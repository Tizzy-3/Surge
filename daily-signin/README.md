# Surge 5 每日签到

从 [Tizzy-3/quantumultX](https://github.com/Tizzy-3/quantumultX) 迁移的 Surge 原生版本，保留哈士奇、IMYAI、金蝶云社区签到与抽奖、企业微信推送和 BoxJS 配置。

**版本要求：Surge iOS 5.9 或更新版本。** 签到脚本使用 WebView 引擎，为 CryptoJS 4.2.0 提供安全随机数，并降低图片解码对网络扩展进程的内存压力。Surge Mac 5.5+、macOS 11+ 具备相应引擎，但本项目尚未进行 Mac 实机验证。

本功能已迁移到 `daily-signin/`。旧根目录模块和 BoxJS 地址停止使用，请改用下面的新地址。凭证键名及设备本地存储保持原样。

## 安装

1. 保留你正在使用的 Surge 主配置和节点订阅。
2. 在 Surge 的模块管理中，通过 URL 安装：

   ```text
   https://raw.githubusercontent.com/Tizzy-3/Surge/main/daily-signin/DailySignIn.sgmodule
   ```

3. 在 Surge 中生成、安装并信任自己的 MITM 证书，然后开启 MITM 和该模块。模块会追加所需域名；证书需要在设备上配置，仓库不提供证书。
4. 更新下方 BoxJS 订阅，进入「Surge 每日签到」，打开「允许获取 Cookie」（默认关闭）。然后开启 Surge 接管流量，在手机浏览器中分别登录并访问：

   - 哈士奇：<https://www.haxiaohaios2.com/aspx3/mobile/qiandao.aspx>
   - IMYAI：<https://super.imyaigc.com/>，登录后打开首页或签到页，触发 API 请求。
   - 金蝶云社区：<https://vip.kingdee.com/>，登录后进入个人中心或签到页面。

5. 捕获到新的凭证会通知“获取cookies成功”或“获取token成功”；同一站点通知有 10 分钟冷却。重复且未变化的凭证不重复通知。所需站点全部获取成功后，在 BoxJS 关闭「允许获取 Cookie」；关闭不会清除凭证，也不影响定时签到或手动测试。此开关需要手动关闭，不会在第一个站点获取成功后自动关闭。
6. 打开 Surge 的**策略组选择页面**，找到「**每日签到 · 手动测试**」面板，点击面板右上角的**刷新按钮**，执行一次实际签到并查看面板及通知中的各站点结果。之后模块会在**设备本地时间每天 07:00**运行，并启用 iOS 定时唤醒。没有凭证的站点会显示「未配置」；账号失效或站点接口变化仍可能导致失败。

安装模块和手动合并 `surge.conf.example` **二选一**，避免重复定时任务。示例仅是需要合并的配置片段，不是包含节点的完整配置。

## 立即手动测试

模块已经包含手动脚本和信息面板，**不需要再修改主配置，也不依赖快捷指令的脚本选择列表**。

1. 更新并启用本模块。旧版本用户需要同时更新模块及引用的脚本；手动入口的脚本 URL 带版本参数，以加载本次新增的面板支持。
2. 打开 Surge 的策略组选择页面，在「每日签到 · 手动测试」面板右上角点刷新。
3. 等待执行完成，面板会显示三个站点的状态、失败原因和完成时间，同时保留原有通知和可选企业微信推送。

这是实际签到测试，会按现有流程执行签到和金蝶抽奖；等待本次执行完成后再点。仅打开策略组页面、自动刷新面板或缺少手动按钮触发标记时，脚本不会发起签到、抽奖或推送。

面板功能及其右上角刷新按钮来自 [Surge 官方信息面板](https://manual.nssurge.com/tools/panel.html)，需要该功能对应的订阅授权。如果面板未显示，请提供策略组页截图以核对模块是否生效及面板显示情况。快捷指令列表是否列出模块内脚本，不能代替实际运行验证。

## BoxJS 配置

如尚未使用 BoxJS，可先安装 [BoxJS 官方 Surge 模块](https://raw.githubusercontent.com/chavyleung/scripts/master/box/rewrite/boxjs.rewrite.surge.sgmodule)，然后打开 BoxJS 页面添加本仓库订阅：

```text
https://raw.githubusercontent.com/Tizzy-3/Surge/main/daily-signin/boxjs.json
```

顶部「允许获取 Cookie」控制哈士奇 / IMYAI / 金蝶云社区的凭证捕获，默认关闭。已有凭证的用户更新后可以保持关闭，直接签到；凭证失效时再打开、重新登录获取、获取完成后关闭。关闭时抓取脚本直接透传，不保存新凭证或弹出获取通知；模块的匹配规则、MITM 域名及 IMYAI 响应体设置仍保留，不等同于关闭 Surge 的整个抓取功能。

可配置哈士奇账号密码、各站点凭证、金蝶产品线 ID、企业微信 Webhook、请求超时、重试次数和调试日志。企业微信推送不填即可关闭，本地仍通过 Surge 通知报告结果。

为方便手动迁移旧配置，设置键仍以 `QX_SIGNIN_` 开头，这是历史名称；脚本运行只使用 Surge 接口。新订阅和应用使用独立 ID，不覆盖原 QX 订阅。

**QX 和 Surge 不共享本地存储。** 复制仓库不会复制手机里的 Cookie/JWT。推荐重新捕获；也可把旧 BoxJS 中需要的值手动填入 Surge 下的 BoxJS。不要将个人 Cookie、JWT、账号密码、Webhook 或 BoxJS 备份提交到公开仓库。

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `DailySignIn.sgmodule` | 一次安装凭证捕获、07:00 定时任务、手动测试面板和 MITM 域名 |
| `surge_signin.js` | 签到、抽奖、汇总通知及可选企业微信推送 |
| `surge_cookie_capture.js` | 按 BoxJS 获取开关捕获并保存登录凭证，不修改请求或响应 |
| `boxjs.json` | Surge 版 BoxJS 订阅 |
| `surge.conf.example` | 不安装模块时，手动合并到现有配置的片段 |
| `tests/surge.test.cjs` | 使用模拟 Surge 接口的离线兼容性测试 |

## 排查

- **捕获不到：** 先确认 BoxJS「允许获取 Cookie」已打开，再检查 Surge 是否接管该浏览器的流量、模块和 MITM 是否启用、证书是否信任；排查其他模块中先匹配的同类型脚本，Surge 对每个请求最多执行一个请求脚本和一个响应脚本。
- **IMYAI 没有 Token：** 登录后进入首页或签到页。API 请求头和 API 响应均可捕获；响应体读取只针对两个 IMYAI API 域名下的 `/api/`，上限 2 MB，超限时由 Surge 跳过响应脚本并透传。
- **加密库加载失败：** 确认 Surge 能访问 cdnjs。CryptoJS 和 pako 首次通过 HTTPS 下载，随后缓存在设备本地。
- **脚本超时：** 模块总超时为 300 秒；BoxJS 中单个请求的超时单位为毫秒，脚本会转换成 Surge 所需的秒。先检查网络和站点状态，再考虑调整总超时。
- **登录已失效：** 打开 BoxJS「允许获取 Cookie」，重新登录相应网站获取凭证，完成后关闭开关。凭证捕获通知只代表保存成功，实际登录状态和签到结果以手动运行结果为准。
- **更新后仍是旧版：** 更新模块并在 Surge 中刷新远程脚本资源。停用本模块即可停止定时任务和捕获。

## 验证范围与来源

本项目迁移自 QX 仓库提交 [`954d7aa`](https://github.com/Tizzy-3/quantumultX/commit/954d7aae85f8f1248eb779888777635b221cbaa3)。保留原签到流程及图片，替换网络请求、持久化、通知接口和安装配置。原仓库当前版本已删除的 VVebo 脚本不在迁移范围内。

在仓库根目录使用 Node.js 18+ 可运行：

```sh
node --check daily-signin/surge_signin.js
node --check daily-signin/surge_cookie_capture.js
node --test daily-signin/tests/surge.test.cjs
```

测试使用模拟响应，不会登录网站、签到、抽奖或发送企业微信消息。离线测试不等于 Surge 实机验证；MITM 捕获、iOS 后台定时运行和站点实际签到结果仍需在设备上确认。

接口依据：[Surge 脚本 API](https://manual.nssurge.com/scripting/api.html)、[脚本引擎](https://manual.nssurge.com/scripting/overview.html)、[定时任务](https://manual.nssurge.com/scripting/cron.html)、[模块](https://manual.nssurge.com/profile/module.html)。
