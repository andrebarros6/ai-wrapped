// Filters chat titles before suggesting any of them for a card. Conservative on purpose: when in
// doubt, a title is dropped. Suggestions are off by default and always user-confirmed.

// Stems in English, Portuguese, French and Spanish (matched as substrings of the lower-cased title).
const SENSITIVE_STEMS = [
  // health
  "doctor", "hospital", "health", "symptom", "diagnos", "medic", "pill", "therap", "cancer", "pain",
  "pregnan", "ivf", "fertil", "mental", "anxiety", "depress", "surgery", "vaccin", "disease", "illness",
  "saúde", "médic", "grávid", "santé", "maladie", "salud", "enferm", "embaraz",
  // money
  "salary", "debt", "loan", "mortgage", "bank", "invoice", "tax", "irs", "finance", "money", "rent",
  "budget", "payroll", "credit", "dinheiro", "imposto", "salário", "dívida", "argent", "impôt", "dinero",
  "impuesto", "deuda", "sueldo",
  // legal
  "lawyer", "legal", "court", "lawsuit", "visa", "immigra", "divorce", "custody", "police", "fine ",
  "advogad", "tribunal", "divórcio", "avocat", "abogad", "divorcio",
  // family
  "wife", "husband", "son ", "daughter", "mom", "mum", "dad", "mother", "father", "parent", "family",
  "kid", "child", "baby", "funeral", "death", "died", "família", "filh", "mãe", "pai ", "bebé", "famille",
  "enfant", "familia", "hij", "madre", "padre",
  // job rejection
  "reject", "fired", "layoff", "laid off", "resign", "unemploy", "redundan", "despedid", "desemprego",
  "licenci", "chômage", "despido", "paro ",
];

// A Capitalised word after the first one ("Maria", "Acme") could be a person or company.
// All-caps acronyms ("SQL", "API") are fine.
const NAME_LIKE = /\s\p{Lu}\p{Ll}/u;
const CONTACT_LIKE = /@|https?:|www\.|\d{3,}/i;

export function isSafeTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 3 || t.length > 80) return false;
  const lower = ` ${t.toLowerCase()} `;
  if (SENSITIVE_STEMS.some((s) => lower.includes(s))) return false;
  if (NAME_LIKE.test(t) || CONTACT_LIKE.test(t)) return false;
  return true;
}

/** Up to `max` distinct safe titles, in order. */
export function safeTitles(titles: readonly string[], max = 6): string[] {
  const out: string[] = [];
  for (const t of titles) {
    const clean = t.trim();
    if (isSafeTitle(clean) && !out.includes(clean)) out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}
