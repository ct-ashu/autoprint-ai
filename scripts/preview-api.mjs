// Runs the hosted API unchanged, with SQLite and private files for development.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
import handler from "../worker/index.js";
export async function localEnvironment(root, statePath) {
  const state = statePath || path.join(root, ".sites-runtime");
  await fs.mkdir(path.join(state, "files"), { recursive: true });
  const db = new DatabaseSync(path.join(state, "preview.sqlite3"));
  db.exec("CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY)");
  for (const file of (await fs.readdir(path.join(root, "drizzle")))
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    if (!db.prepare("SELECT name FROM _migrations WHERE name=?").get(file)) {
      db.exec(await fs.readFile(path.join(root, "drizzle", file), "utf8"));
      db.prepare("INSERT INTO _migrations(name) VALUES(?)").run(file);
    }
  }
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => db.prepare(sql).get(...args) || null,
            all: async () => ({ results: db.prepare(sql).all(...args) }),
            run: async () => ({
              meta: { changes: Number(db.prepare(sql).run(...args).changes) },
            }),
          };
        },
      };
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const BUCKET = {
    async put(key, data) {
      const target = path.join(state, "files", key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, Buffer.from(data));
    },
    async get(key) {
      try {
        return { body: await fs.readFile(path.join(state, "files", key)) };
      } catch {
        return null;
      }
    },
  };
  return { DB, BUCKET };
}
export function previewAPI(root) {
  return {
    name: "autoprint-local-api",
    async configureServer(server) {
      const env = await localEnvironment(root);
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith("/api/")) return next();
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 11 * 1024 * 1024) {
              res.writeHead(413, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({ error: "Files must be 10 MB or smaller." }),
              );
              return;
            }
            chunks.push(chunk);
          }
          const request = new Request("http://" + req.headers.host + req.url, {
            method: req.method,
            headers: req.headers,
            body: ["GET", "HEAD"].includes(req.method)
              ? undefined
              : Buffer.concat(chunks),
          });
          const response = await handler.fetch(request, env);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}
