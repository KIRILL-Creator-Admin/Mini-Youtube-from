const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const uploadDir = path.join(__dirname, "uploads/videos");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "video-" + unique + path.extname(file.originalname).toLowerCase());
  }
});
const upload = multer({ storage }).single("video");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads/videos", express.static(uploadDir));

const metaFile = path.join(__dirname, "uploads/meta.json");
if (!fs.existsSync(metaFile)) fs.writeFileSync(metaFile, "[]");
function loadMeta() { return JSON.parse(fs.readFileSync(metaFile)); }
function saveMeta(data) { fs.writeFileSync(metaFile, JSON.stringify(data, null, 2)); }

app.get("/videos", (req, res) => res.json(loadMeta()));

app.post("/upload", (req, res) => {
  upload(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Видео не получено" });

    const meta = loadMeta();
    const entry = {
      filename: req.file.filename,
      size: req.file.size,
      mtime: Date.now(),
      url: "/stream/" + encodeURIComponent(req.file.filename),
      owner: req.body.owner || "anonymous"
    };
    meta.push(entry);
    saveMeta(meta);
    res.json(entry);
  });
});

app.get("/stream/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Файл не найден" });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = "video/mp4";

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.delete("/videos/:filename", (req, res) => {
  const filename = req.params.filename;
  const user = req.body.owner || "anonymous";

  let meta = loadMeta();
  const video = meta.find(v => v.filename === filename);
  if (!video) return res.status(404).json({ error: "Видео не найдено" });

  if (video.owner !== user) {
    return res.status(403).json({ error: "Удалять может только владелец" });
  }

  meta = meta.filter(v => v.filename !== filename);
  saveMeta(meta);

  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mini YouTube запущен: http://localhost:${PORT}`));