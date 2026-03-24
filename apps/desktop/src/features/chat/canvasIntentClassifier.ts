export type CanvasIntent = "surgical" | "creative";

const CREATIVE_TRIGGERS = [
  // tom e estilo
  "tom", "tone", "gentil", "formal", "informal", "rude",
  "profissional", "amigável", "sério", "humorístico",
  "persuasivo", "empático", "mais suave", "menos agressivo",
  // reescrita livre
  "reescreva", "rewrite", "reformule", "refaça",
  "melhore o texto", "melhore a escrita",
  "mais claro", "mais conciso", "mais elaborado", "mais detalhado",
  // estrutura e transformação
  "reorganize", "resuma", "expanda", "adapte", "traduza",
  "parafraseie", "simplifique", "desenvolva",
];

export function classifyIntent(userCommand: string): CanvasIntent {
  const lower = userCommand.toLowerCase();
  return CREATIVE_TRIGGERS.some((trigger) => lower.includes(trigger))
    ? "creative"
    : "surgical";
}
