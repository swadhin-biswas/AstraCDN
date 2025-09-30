// src/lib/turso.ts

export async function tursoExec(env: any, requests: any[]) {
  const url = env.TURSO_URL;
  const token = env.TURSO_TOKEN;

  if (!url || !token) {
    console.error("Missing Turso credentials:", { hasUrl: !!url, hasToken: !!token });
    throw new Error("TURSO_URL or TURSO_TOKEN not set in env");
  }

  const payload = {
    requests: requests.map((req) => {
      if (typeof req === "string") {
        return { type: "execute", stmt: { sql: req } };
      } else {
        return {
          type: "execute",
          stmt: {
            sql: req.sql,
            args: req.args || [],
          },
        };
      }
    }),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Turso HTTP error", res.status, text);
    throw new Error(`Turso request failed: ${res.status} - ${text}`);
  }

  const result = await res.json();

  if (result.results) {
    result.results.forEach((r: any, i: number) => {
      if (r.type === "error") {
        console.error(`Turso query ${i} error:`, JSON.stringify(r.error));
        throw new Error(`Turso query error: ${JSON.stringify(r.error)}`);
      }
    });
  }

  return result;
}

export async function ensureTable(env: any) {
  const createSql = `CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fileId TEXT UNIQUE,
    channelId TEXT,
    originalName TEXT,
    createdAt TEXT
  )`;
  try {
    const result = await tursoExec(env, [createSql]);
    if (result.results && result.results[0] && result.results[0].type === "error") {
      throw new Error(`Turso error: ${JSON.stringify(result.results[0].error)}`);
    }
    return result;
  } catch (err) {
    console.error("Table create error:", err);
    throw err;
  }
}

export async function saveToTurso(imageData: any, env: any) {
  try {
    await ensureTable(env);
    const createdAt = new Date().toISOString();
    const sql = {
      sql: `INSERT OR REPLACE INTO images (fileId, channelId, originalName, createdAt)
            VALUES (?, ?, ?, ?)`,      args: [
        { type: "text", value: imageData.fileId },
        { type: "text", value: imageData.channelId },
        { type: "text", value: imageData.originalName },
        { type: "text", value: createdAt },
      ],
    };
    const result = await tursoExec(env, [sql]);
    if (result.results?.[0]?.type === "error") {
      throw new Error(result.results[0].error.message || "Unknown Turso error");
    }
    return { success: true };
  } catch (err) {
    console.error("Turso save error:", err);
    return { success: false, error: (err as Error).message || String(err) };
  }
}

export async function getImageFromTurso(fileId: string, env: any) {
  try {
    await ensureTable(env);
    const sql = {
      sql: `SELECT fileId, channelId, originalName, createdAt FROM images WHERE fileId = ? LIMIT 1`,
      args: [{ type: "text", value: fileId }],
    };
    const result = await tursoExec(env, [sql]);
    const r = result?.results?.[0];
    if (!r || r.type === "error") {
      console.error("Query error:", r?.error);
      return null;
    }
    if (r.type === "ok" && r.response?.result?.rows?.length > 0) {
      const cols = r.response.result.cols.map((c: any) => c.name);
      const row = r.response.result.rows[0];
      const obj: { [key: string]: any } = {};
      cols.forEach((c: string, i: number) => {
        const val = row[i];
        obj[c] = val?.value !== undefined ? val.value : val;
      });
      return obj;
    }
    return null;
  } catch (err) {
    console.error("Turso get error:", err);
    throw err;
  }
}

export async function listFilesFromTurso(page: number, limit: number, env: any) {
    try {
        await ensureTable(env);
        const offset = (page - 1) * limit;
        const listSql = {
            sql: `SELECT fileId, originalName, createdAt FROM images
                  ORDER BY datetime(createdAt) DESC LIMIT ? OFFSET ?`,
            args: [
                { type: "integer", value: limit },
                { type: "integer", value: offset }
            ]
        };
        const countSql = `SELECT COUNT(*) as count FROM images`;

        const res = await tursoExec(env, [listSql, countSql]);

        const listResult = res.results?.[0];
        const countResult = res.results?.[1];

        let files: any[] = [];
        if (listResult?.type === "ok" && listResult.response?.result?.rows?.length) {
            const cols = listResult.response.result.cols.map((c: any) => c.name);
            files = listResult.response.result.rows.map((row: any) => {
                const obj: { [key: string]: any } = {};
                cols.forEach((c: string, i: number) => {
                    const val = row[i];
                    obj[c] = val?.value !== undefined ? val.value : val;
                });
                obj.url = `/file/${obj.fileId}`;
                return obj;
            });
        }

        let total = 0;
        if (countResult?.type === "ok" && countResult.response?.result?.rows?.length) {
            const countVal = countResult.response.result.rows[0][0];
            total = parseInt(countVal?.value !== undefined ? countVal.value : countVal) || 0;
        }

        return { files, total };
    } catch (err) {
        console.error("Turso list error:", err);
        throw err;
    }
}

export async function deleteFromTurso(fileId: string, env: any) {
  try {
    await ensureTable(env);
    const sql = {
      sql: `DELETE FROM images WHERE fileId = ?`,
      args: [{ type: "text", value: fileId }],
    };
    const result = await tursoExec(env, [sql]);
    if (result.results?.[0]?.type === "error") {
      throw new Error(result.results[0].error.message || "Unknown Turso error");
    }
    return { success: true };
  } catch (err) {
    console.error("Turso delete error:", err);
    return { success: false, error: (err as Error).message || String(err) };
  }
}
