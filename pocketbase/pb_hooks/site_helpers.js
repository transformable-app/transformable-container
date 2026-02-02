// Shared helpers for site deploy hooks. Load with require() inside each handler.
module.exports = {
  MAX_ZIP_BYTES: 100 * 1024 * 1024,
  FORBIDDEN_SUBSTRINGS: ["..", ".pb.js", ".sh", ".exe", ".dll", ".so", ".dylib"],
  requireDeployToken: function (e) {
    var token = this.getDeployToken();
    if (!token) throw new UnauthorizedError("SITE_DEPLOY_TOKEN not configured");
    var auth = e.request.header.get("Authorization");
    if (!auth || auth.slice(0, 7) !== "Bearer ") throw new UnauthorizedError("Missing or invalid Authorization");
    var submitted = auth.slice(7).trim();
    if (submitted !== token) throw new UnauthorizedError("Invalid deploy token");
  },
  getDeployToken: function () {
    return (typeof $os !== "undefined" && $os.getenv("SITE_DEPLOY_TOKEN")) || (typeof process !== "undefined" && process.env.SITE_DEPLOY_TOKEN) || "";
  },
  getSiteRoot: function () {
    var root = (typeof $os !== "undefined" && $os.getenv("SITE_ROOT")) || (typeof process !== "undefined" && process.env.SITE_ROOT) || "/site";
    if (root && root.indexOf("/") !== 0 && typeof $os !== "undefined" && typeof $os.getwd === "function") {
      try { root = $os.getwd() + "/" + String(root).replace(/^\.\//, ""); } catch (e) {}
    }
    return root || "/site";
  },
  deleteReleaseFolder: function (recordId) {
    if (!recordId || String(recordId).indexOf("/") >= 0 || String(recordId).indexOf("..") >= 0) return;
    var siteRoot = String(this.getSiteRoot()).replace(/\/+$/, "");
    var releasesBase = siteRoot + "/releases";
    var releaseDir = releasesBase + "/" + recordId;
    if (releaseDir.indexOf(releasesBase + "/") !== 0 || releaseDir.slice(releasesBase.length + 1).indexOf("/") >= 0) return;
    try { $os.cmd("rm", "-rf", releaseDir).run(); } catch (err) {
      try { $os.removeAll(releaseDir); } catch (e2) {}
      if (typeof $app !== "undefined" && $app.logger) $app.logger().error("deleteReleaseFolder: " + releaseDir + " " + String(err));
    }
  },
  getSiteUrl: function () {
    return (typeof $os !== "undefined" && $os.getenv("SITE_URL")) || (typeof process !== "undefined" && process.env.SITE_URL) || "https://www.example.com";
  },
  siteCurrentPath: function (app) {
    return app.dataDir() + "/site_current.json";
  },
  readCurrentRevisionId: function (app) {
    try {
      var path = app.dataDir() + "/site_current.json";
      var raw = $os.readFile(path);
      if (!raw) return "";
      var str = typeof raw === "string" ? raw : (raw.length ? String.fromCharCode.apply(null, raw) : "");
      if (!str) return "";
      var data = JSON.parse(str);
      return data.currentRevisionId || "";
    } catch (e) {
      return "";
    }
  },
  writeCurrentRevisionId: function (app, id) {
    var path = app.dataDir() + "/site_current.json";
    var data = JSON.stringify({ currentRevisionId: id || "" });
    $os.writeFile(path, data, 0o600);
  }
};
