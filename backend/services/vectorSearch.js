const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Inserts pre-embedded chunks into the "documents" table.
 * Each item: { content: string, embedding: number[] }
 */
async function insertDocuments(items, filename) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      const vectorLiteral = `[${item.embedding.join(",")}]`;
      await client.query(
        "INSERT INTO documents (content, filename, embedding) VALUES ($1, $2, $3)",
        [item.content, filename, vectorLiteral]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Finds the top-k most similar chunks to the given embedding via the
 * match_documents RPC (see schema.sql), ordered by cosine similarity.
 */
async function similaritySearch(embedding, topK = 3) {
  const vectorLiteral = `[${embedding.join(",")}]`;
  const { rows } = await pool.query(
    "SELECT id, content, filename, similarity FROM match_documents($1, $2)",
    [vectorLiteral, topK]
  );
  return rows;
}

module.exports = { pool, insertDocuments, similaritySearch };
