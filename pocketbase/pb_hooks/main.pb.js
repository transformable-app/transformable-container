// Site deploy API: deploy, rollback, revisions. Requires SITE_DEPLOY_TOKEN and optional SITE_ROOT, SITE_URL.
// Singleton: pb_data/site_current.json stores currentRevisionId. "revisions" collection is created on bootstrap if missing.

onBootstrap(function (e) {
  e.next();
  try {
    var coll = $app.findCollectionByNameOrId("revisions");
    coll.integrityChecks(false);
    $app.save(coll);
    return;
  } catch (err) {}
  var coll = new Collection({
    type: "base",
    name: "revisions",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "message", type: "text", required: false },
      { name: "status", type: "select", required: true, values: ["uploaded", "staged", "active"] },
      { name: "hash", type: "text", required: false },
      { name: "path", type: "text", required: true }
    ]
  });
  coll.integrityChecks(false);
  $app.save(coll);
});
routerAdd("POST", "/api/site/deploy", function (e) {
  var helpers = require(__hooks + "/site_helpers.js");
  helpers.requireDeployToken(e);
  var siteRoot = helpers.getSiteRoot();
  var siteUrl = helpers.getSiteUrl();

  var files = e.findUploadedFiles("file");
  if (!files || files.length === 0) throw new BadRequestError("missing file");
  var file = files[0];
  var reader = file.reader.open();
  var zipBytes = toBytes(reader, helpers.MAX_ZIP_BYTES);
  if (typeof reader.close === "function") reader.close();

  var body = e.requestInfo().body || {};
  var message = (body.message != null) ? String(body.message) : "";

  var collection = $app.findCollectionByNameOrId("revisions");
  if (!collection) throw new InternalServerError("revisions collection not found");
  var record = new Record(collection);
  record.set("message", message);
  record.set("status", "uploaded");
  record.set("path", "pending");
  record.set("hash", "");
  $app.save(record);
  var savedId = record.get("id") || "";
  if (!savedId) savedId = record.id();
  var releaseDir = siteRoot + "/releases/" + savedId;

  function deleteRevisionById(id) {
    try {
      var r = $app.findRecordById(collection, id);
      if (r && typeof r.set === "function") $app.delete(r);
    } catch (ignore) {}
  }

  try { $os.mkdirAll(releaseDir, 0o755); } catch (mkdirErr) {
    deleteRevisionById(savedId);
    throw new BadRequestError("failed to create release dir: " + String(mkdirErr));
  }

  var tempPath = $os.tempDir() + "/" + $security.randomString(12) + ".zip";
  try {
    $os.writeFile(tempPath, zipBytes, 0o600);
  } catch (err) {
    deleteRevisionById(savedId);
    $os.removeAll(releaseDir);
    throw new BadRequestError("failed to write zip");
  }

  // Validate zip: list and check for zip-slip / forbidden
  var listOut = "";
  try {
    listOut = toString($os.cmd("unzip", "-l", tempPath).output());
  } catch (err) {
    $os.remove(tempPath);
    deleteRevisionById(savedId);
    $os.removeAll(releaseDir);
    throw new BadRequestError("invalid zip or unzip not available");
  }
  var lines = listOut.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf("..") >= 0 || (line.length > 0 && line.charAt(0) === "/")) {
      $os.remove(tempPath);
      deleteRevisionById(savedId);
      $os.removeAll(releaseDir);
      throw new BadRequestError("zip contains invalid path");
    }
    for (var j = 0; j < helpers.FORBIDDEN_SUBSTRINGS.length; j++) {
      if (line.indexOf(helpers.FORBIDDEN_SUBSTRINGS[j]) >= 0) {
        $os.remove(tempPath);
        deleteRevisionById(savedId);
        $os.removeAll(releaseDir);
        throw new BadRequestError("zip contains forbidden file");
      }
    }
  }

  try {
    $os.cmd("unzip", "-o", "-q", tempPath, "-d", releaseDir).run();
  } catch (err) {
    $os.remove(tempPath);
    deleteRevisionById(savedId);
    $os.removeAll(releaseDir);
    throw new BadRequestError("failed to extract zip");
  }
  $os.remove(tempPath);

  // Sanity: must have index.html
  try {
    $os.stat(releaseDir + "/index.html");
  } catch (err) {
    deleteRevisionById(savedId);
    $os.removeAll(releaseDir);
    throw new BadRequestError("zip must contain index.html at root");
  }

  var rec = $app.findRecordById(collection, savedId);
  rec.set("path", "releases/" + savedId + "/");
  $app.save(rec);

  var currentId = helpers.readCurrentRevisionId($app);
  if (currentId) {
    try {
      var prev = $app.findRecordById("revisions", currentId);
      prev.set("status", "staged");
      $app.save(prev);
    } catch (ignore) {}
  }

  var currentLink = siteRoot + "/current";
  var currentTarget = "releases/" + savedId;
  try {
    $os.cmd("ln", "-sfn", currentTarget, currentLink).run();
  } catch (err) {
    rec.set("status", "failed");
    $app.save(rec);
    throw new InternalServerError("failed to update current symlink");
  }

  rec.set("status", "active");
  $app.save(rec);
  helpers.writeCurrentRevisionId($app, savedId);

  return e.json(200, {
    currentRevisionId: savedId,
    url: siteUrl + "/",
    message: message
  });
}, $apis.bodyLimit(100 * 1024 * 1024));

routerAdd("POST", "/api/site/rollback", function (e) {
  var helpers = require(__hooks + "/site_helpers.js");
  helpers.requireDeployToken(e);
  var siteRoot = helpers.getSiteRoot();

  var body = e.requestInfo().body || {};
  var revisionId = (body.revisionId != null) ? String(body.revisionId).trim() : "";
  if (!revisionId) throw new BadRequestError("Missing revisionId.");

  var record = $app.findRecordById("revisions", revisionId);
  var pathVal = record.get("path");
  var releaseDir = siteRoot + "/" + (pathVal ? pathVal.replace(/\/+$/, "") : "releases/" + revisionId);
  try {
    $os.stat(releaseDir);
  } catch (err) {
    throw new NotFoundError("revision directory not found");
  }

  var currentId = helpers.readCurrentRevisionId($app);
  if (currentId) {
    try {
      var prev = $app.findRecordById("revisions", currentId);
      prev.set("status", "staged");
      $app.save(prev);
    } catch (ignore) {}
  }

  var currentLink = siteRoot + "/current";
  var currentTarget = pathVal ? pathVal.replace(/\/+$/, "") : "releases/" + revisionId;
  try {
    $os.cmd("ln", "-sfn", currentTarget, currentLink).run();
  } catch (err) {
    throw new InternalServerError("failed to update symlink");
  }

  record.set("status", "active");
  $app.save(record);
  helpers.writeCurrentRevisionId($app, revisionId);

  return e.json(200, { currentRevisionId: revisionId });
});

routerAdd("GET", "/api/site/revisions", function (e) {
  var helpers = require(__hooks + "/site_helpers.js");
  helpers.requireDeployToken(e);
  var limit = 20;
  var q = e.request.url.query().get("limit");
  if (q) {
    var n = parseInt(q, 10);
    if (n >= 1 && n <= 100) limit = n;
  }
  var currentId = helpers.readCurrentRevisionId($app);
  var records = $app.findRecordsByFilter("revisions", "", "-created", limit, 0);
  var items = [];
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    items.push({
      id: r.id(),
      createdAt: r.get("created"),
      message: r.get("message") || "",
      hash: r.get("hash") || "",
      status: r.get("status") || ""
    });
  }
  return e.json(200, { currentRevisionId: currentId, items: items });
});

function cleanupRevisionReleaseFolder(recordId, app) {
  var helpers = require(__hooks + "/site_helpers.js");
  if (!recordId) return;
  var currentId = helpers.readCurrentRevisionId(app);
  if (currentId && currentId === recordId) return;
  helpers.deleteReleaseFolder(recordId);
}

// Run cleanup when delete is requested (API/Admin UI). No tag so hook runs for every delete; we only act if record is in revisions.
onRecordDeleteRequest(function (e) {
  var path = (e.request && e.request.url && e.request.url.path != null) ? String(e.request.url.path) : "";
  $app.logger().info("onRecordDeleteRequest: " + path);
  var recordId = "";
  if (e.record && typeof e.record.get === "function") recordId = e.record.get("id") || "";
  if (!recordId && path) {
    var parts = path.split("/");
    recordId = parts.length > 0 ? parts[parts.length - 1] : "";
    if (recordId.indexOf("?") >= 0) recordId = recordId.slice(0, recordId.indexOf("?"));
  }
  if (!recordId) return e.next();
  try {
    var coll = $app.findCollectionByNameOrId("revisions");
    var rec = $app.findRecordById(coll, recordId);
    if (!rec) return e.next();
    $app.logger().info("revisions delete: removing release folder " + recordId);
    var helpers = require(__hooks + "/site_helpers.js");
    var currentId = helpers.readCurrentRevisionId($app);
    if (currentId && currentId === recordId) throw new BadRequestError("cannot delete the current revision");
    helpers.deleteReleaseFolder(recordId);
  } catch (err) {
    if (err && err.message && String(err.message).indexOf("cannot delete") >= 0) throw err;
  }
  e.next();
});

// Also run cleanup in model delete hook as backup.
onRecordDelete(function (e) {
  var coll = e.record && typeof e.record.Collection === "function" ? e.record.Collection() : (e.collection || null);
  if (!coll || (coll.name || "") !== "revisions") return e.next();
  var recordId = (e.record.get && e.record.get("id")) || "";
  cleanupRevisionReleaseFolder(recordId, $app);
  e.next();
});
