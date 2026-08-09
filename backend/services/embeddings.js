let extractorPromise = null;

/**
 * Lazily loads the local embedding pipeline (downloaded + cached on first use).
 * Kept as a singleton promise so concurrent requests share one load.
 */
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import("@xenova/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")
    );
  }
  return extractorPromise;
}

/**
 * Embeds a single string into a 384-dim vector (mean-pooled, normalized).
 */
async function embedText(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Embeds a batch of strings sequentially. @xenova/transformers pipelines
 * are not safe to call concurrently on the same instance.
 */
async function embedBatch(texts) {
  const embeddings = [];
  for (const text of texts) {
    embeddings.push(await embedText(text));
  }
  return embeddings;
}

/**
 * Splits text into overlapping chunks by character count.
 */
function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  const step = chunkSize - overlap;
  for (let start = 0; start < text.length; start += step) {
    const chunk = text.slice(start, start + chunkSize).trim();
    if (chunk) chunks.push(chunk);
    if (start + chunkSize >= text.length) break;
  }
  return chunks;
}

module.exports = { embedText, embedBatch, chunkText };
