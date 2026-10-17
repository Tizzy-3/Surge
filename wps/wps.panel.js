/* WPS manual-test panel. Runs the configured upstream cron through Surge's API. */
const WPS_SCRIPT_NAME = "WPS签到";
let completed = false;

function finish(title, content, style = "info") {
  if (completed) return;
  completed = true;
  $done({ title, content, style });
}

function main() {
  const isPanel = typeof $input !== "undefined" && $input && $input.purpose === "panel";
  const isButton = typeof $trigger !== "undefined" && $trigger === "button";
  if (!isPanel || !isButton) {
    finish("WPS · 手动测试", "点击右上角刷新按钮执行一次 WPS 任务。\n自动运行：每天设备本地时间 10:00。");
    return;
  }
  if (!$persistentStore.read("wps_sid")) {
    finish("WPS · 缺少 Cookie", "请先登录 WPS App，进入福利中心或任务中心获取 Cookie，再点刷新测试。", "error");
    return;
  }
  if (typeof $httpAPI !== "function") {
    finish("WPS · 无法执行", "当前环境未提供 Surge $httpAPI，请检查 Surge 版本与模块加载状态。", "error");
    return;
  }

  console.log(`[WPS_PANEL] 请求执行 ${WPS_SCRIPT_NAME}`);
  // Call once. Never replay a sign-in when the execution outcome is unclear.
  $httpAPI("POST", "/v1/scripting/cron/evaluate", { script_name: WPS_SCRIPT_NAME }, (result) => {
    if (completed) return;
    const error = result && (result.error || result.exception);
    if (error) {
      const detail = typeof error === "string" ? error : JSON.stringify(error);
      console.log(`[WPS_PANEL] 执行接口返回错误：${detail}`);
      finish("WPS · 执行异常", `${detail}\n请查看 WPS 通知和日志确认实际执行结果。`, "error");
      return;
    }
    if (result == null) {
      finish("WPS · 执行状态待确认", "接口未返回明确状态，请先查看 WPS 通知和日志确认结果，再决定是否重试。");
      return;
    }
    console.log("[WPS_PANEL] 执行接口已返回；各任务结果以 WPS 通知和日志为准。");
    finish("WPS · 手动执行", `执行接口已返回。请查看「WPS 任务汇总」通知和 WPS签到 的脚本日志。\n返回时间：${new Date().toLocaleString()}`);
  });
}

try {
  main();
} catch (error) {
  console.log(`[WPS_PANEL] ${error.message || error}`);
  finish("WPS · 执行异常", `${error.message || error}\n若已发起任务，请先检查通知和日志中的结果。`, "error");
}
