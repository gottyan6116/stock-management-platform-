import { createHash } from "crypto";
import type { InvestmentEvidence } from "./builder";

/**
 * その分析がどのevidence行に基づいていたかを表す安定なハッシュ。
 * 値そのものではなく行IDの集合だけを見る（各配列をソートして順序非依存にする）ため、
 * 同じ行の集合なら常に同じハッシュになる。将来evidenceが変更/追加されたら別ハッシュになり、
 * 「前回分析時と同じ根拠か」をanalysis_runs.evidence_hashで比較できるようにする。
 */
export function computeEvidenceHash(evidence: InvestmentEvidence): string {
  const idSets = {
    financials: evidence.financials.map((m) => m.id).sort(),
    managementStatements: evidence.managementStatements.map((m) => m.id).sort(),
    catalysts: evidence.catalysts.map((c) => c.id).sort(),
    risks: evidence.risks.map((r) => r.id).sort(),
    events: evidence.events.map((e) => e.id).sort(),
    opinions: evidence.opinions.map((o) => o.id).sort(),
    research: evidence.research.map((r) => r.id).sort(),
  };
  return createHash("sha256").update(JSON.stringify(idSets)).digest("hex");
}
