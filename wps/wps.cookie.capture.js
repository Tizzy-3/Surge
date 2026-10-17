/* Surge-only WPS capture control. Uses the wps_sid storage contract documented by
 * MaYIHEI/paperclip: https://github.com/MaYIHEI/paperclip/tree/main/app/wps
 * Sign-in remains handled by the original author's wps.js.
 */
(function captureWps() {
  try {
    // Default off; do not inspect traffic, write credentials or notify while off.
    const enabled = String($persistentStore.read("wps_capture_enabled") || "").trim();
    if (!/^(true|1)$/i.test(enabled)) return;

    const request = typeof $request === "undefined" ? null : $request;
    if (!request || String(request.method || "").toUpperCase() === "OPTIONS") return;
    if (!/^https:\/\/personal-act\.wps\.cn\/activity-rubik\/activity\/page_info(?:[?#]|$)/.test(request.url || "")) return;
    const headers = request.headers || {};
    const cookieHeader = Object.keys(headers).find((key) => key.toLowerCase() === "cookie");
    const cookie = cookieHeader ? String(headers[cookieHeader]) : "";
    const match = /(?:^|;\s*)wps_sids?=([^;]+)/.exec(cookie);
    if (!match) return;

    const sid = match[1];
    if ($persistentStore.read("wps_sid") === sid) return;
    if (!$persistentStore.write(sid, "wps_sid")) {
      console.log("[WPS_CAPTURE] Cookie 保存失败，未发送获取成功通知。");
      return;
    }
    $notification.post("WPS", "✅ WPS Cookie 获取成功", "获取完成后，可在 BoxJS「WPS Cookie 获取开关」中关闭获取；每日签到继续使用已保存的 Cookie。");
  } catch (_) {
    console.log("[WPS_CAPTURE] 获取异常，请检查脚本和本地存储状态。");
  } finally {
    $done({});
  }
})();
