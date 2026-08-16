export function isSampleResearchEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SAMPLE_RESEARCH === "true";
}
