/**
 * モデルの生出力からJSON本体を取り出す。LLMはJSON前後に説明文やmarkdownの
 * コードフェンス（```json ... ```）を付けることがあるため、文字列の場合は
 * 最初の '{' から最後の '}' までを抽出してからパースする。Cloudflare Workers AI
 * の一部モデルは出力がJSON形状だと判定すると、文字列ではなくパース済みオブジェクト
 * をそのまま返すため、オブジェクトが渡された場合はそのまま返す（再パースしない）。
 */
export function extractJsonFromAiResponse(raw: unknown): unknown {
  if (typeof raw === "string") {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error(`AI response contained no JSON object: ${raw.slice(0, 200)}`);
    }
    const jsonText = raw.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonText);
    } catch (err) {
      throw new Error(`AI response JSON could not be parsed: ${(err as Error).message}`);
    }
  }
  if (raw !== null && typeof raw === "object") {
    return raw;
  }
  throw new Error(`AI response was neither a JSON string nor an object (got ${typeof raw})`);
}
