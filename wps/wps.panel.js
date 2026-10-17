/* Run the original WPS script once and display its notifications in the panel. */
const WPS_SOURCE = "https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/app/wps/wps.js";
let completed = false;
let started = false;
let deadline;
const notices = [];

function finish(title, content, style = "info") {
  if (completed) return;
  completed = true;
  if (deadline) clearTimeout(deadline);
  $done({ title, content, style });
}

function showResults() {
  const content = notices.map((parts) => parts.filter(Boolean).join("\n")).join("\n\n");
  if (!content) {
    finish("WPS · 未收到任务结果", "原脚本已结束，但没有返回通知内容。请查看 WPS_Manual_Test 日志；本次不会自动重试。");
    return;
  }
  finish("WPS · 任务结果", content, /❌|🚫|⚠️/.test(content) ? "error" : "info");
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

  // This deadline ends the panel; it never replays a potentially completed task.
  deadline = setTimeout(() => {
    const partial = notices.map((parts) => parts.filter(Boolean).join("\n")).join("\n\n");
    finish("WPS · 执行超时", `${partial ? partial + "\n\n" : ""}原脚本未在时限内结束。请查看 WPS_Manual_Test 日志和 WPS 通知，确认结果后再决定是否重试。`, "error");
  }, 140000);
  console.log("[WPS_PANEL] 加载原作者脚本；本次手动任务只启动一次。");
  // Do not attach the account Cookie to this public source-code request.
  $httpClient.get({ url: WPS_SOURCE, timeout: 15 }, (error, response, source) => {
    if (completed || started) return;
    if (error || !response || Number(response.status || response.statusCode) !== 200 || typeof source !== "string" || !source.trim()) {
      console.log("[WPS_PANEL] 原脚本下载失败，未启动 WPS 任务。");
      finish("WPS · 脚本加载失败", "无法下载原作者脚本，本次没有启动 WPS 任务。请检查 GitHub Raw 连接后再测试。", "error");
      return;
    }
    try {
      // Preserve native HTTP/storage and the upstream logic. Only bridge completion
      // and notifications so the panel waits for actual task results.
      const execute = new Function("$done", "$notification", source);
      started = true;
      console.log("[WPS_PANEL] 原脚本已启动，等待任务汇总。");
      execute(showResults, {
        post(...parts) {
          if (completed) return;
          notices.push(parts.slice(0, 3).map((part) => String(part == null ? "" : part)));
          try {
            if (typeof $notification !== "undefined") $notification.post(...parts);
          } catch (_) {
            console.log("[WPS_PANEL] 系统通知未能发送，结果仍保留在面板中。");
          }
        },
      });
    } catch (error) {
      console.log(`[WPS_PANEL] 原脚本执行异常: ${error.message || error}`);
      finish("WPS · 执行异常", `${error.message || error}\n本次不会自动重试；已发起的任务请结合日志确认。`, "error");
    }
  });
}

try {
  main();
} catch (error) {
  console.log(`[WPS_PANEL] 面板异常: ${error.message || error}`);
  finish("WPS · 面板异常", "请查看 WPS_Manual_Test 日志。本次不会自动重试。", "error");
}
