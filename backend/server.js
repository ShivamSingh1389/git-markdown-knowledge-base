import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import slugify from "slugify";
import { fileURLToPath } from "url";

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const NOTES_DIR = path.join(ROOT, "notes");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

await fs.mkdir(NOTES_DIR, { recursive: true });

async function runGit(args) {
  try {
    return await execFileAsync("git", args, { cwd: ROOT });
  } catch (error) {
    console.error("Git command failed:", args.join(" "), error.stderr || error.message);
    return { stdout: "", stderr: error.stderr || error.message };
  }
}

async function ensureGitRepo() {
  if (!existsSync(path.join(ROOT, ".git"))) {
    await runGit(["init"]);
  }
  await runGit(["config", "user.name", "Git Markdown KB"]);
  await runGit(["config", "user.email", "git-markdown-kb@localhost"]);
}

await ensureGitRepo();

function safeFilename(title) {
  const value = slugify(title || "untitled", { lower: true, strict: true });
  return `${value || "untitled"}.md`;
}

async function listNotes() {
  const names = (await fs.readdir(NOTES_DIR))
    .filter((name) => name.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(names.map(async (name) => {
    const content = await fs.readFile(path.join(NOTES_DIR, name), "utf8");
    return {
      filename: name,
      title: name.replace(/\.md$/, "").replace(/-/g, " "),
      content,
      updatedAt: (await fs.stat(path.join(NOTES_DIR, name))).mtime
    };
  }));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "git-markdown-kb" });
});

app.get("/api/notes", async (_req, res) => {
  res.json(await listNotes());
});

app.post("/api/notes", async (req, res) => {
  const { title, content, filename: previousFilename } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "Title is required." });

  const filename = safeFilename(title);
  const filepath = path.join(NOTES_DIR, filename);
  const previous = previousFilename ? path.basename(previousFilename) : null;
  const previousPath = previous ? path.join(NOTES_DIR, previous) : null;

  // Keep the same note while its title changes, instead of creating duplicate files.
  if (previous && previous !== filename && previous.endsWith(".md") && existsSync(previousPath)) {
    if (existsSync(filepath)) await fs.unlink(filepath);
    await fs.rename(previousPath, filepath);
  }

  await fs.writeFile(filepath, content ?? "", "utf8");

  await runGit(["add", "notes"]);
  await runGit(["commit", "-m", `Auto-save: ${new Date().toISOString()}`]);

  if (String(process.env.AUTO_PUSH).toLowerCase() === "true") {
    await runGit(["push", "origin", process.env.GIT_BRANCH || "main"]);
  }

  res.json({ ok: true, filename, message: "Saved and versioned with Git." });
});

app.delete("/api/notes/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith(".md")) return res.status(400).json({ error: "Invalid file." });

  const filepath = path.join(NOTES_DIR, filename);
  if (!existsSync(filepath)) return res.status(404).json({ error: "Note not found." });

  await fs.unlink(filepath);
  await runGit(["add", "notes"]);
  await runGit(["commit", "-m", `Delete note: ${filename}`]);

  res.json({ ok: true });
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const notes = await listNotes();
  if (!q) return res.json(notes);

  res.json(notes.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.content.toLowerCase().includes(q)
  ));
});

app.get("/api/git-log", async (_req, res) => {
  const result = await runGit([
    "log", "--pretty=format:%h|%ad|%s", "--date=short", "--all", "-20"
  ]);

  const log = result.stdout
    .split("\n")
    .filter(Boolean)
    .map(line => {
      const [hash, date, message] = line.split("|");
      return { hash, date, message };
    });

  res.json(log);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
