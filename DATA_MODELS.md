# Data Models

All models are defined in `src/lib/enneagram.ts` and `src/lib/event-store.ts`.

## `EnneagramType`
```ts
type EnneagramType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
```

## `EnneaTypeInfo`
```ts
interface EnneaTypeInfo {
  type: EnneagramType;
  name: string;         // "The Achiever"
  title: string;        // "Success-Oriented · Adaptive"
  description: string;
  color: string;        // OKLCH swatch
  keywords: string[];
  strengths: string[];
  blindSpots: string[];
  growth: string[];
}
```

## `QuestionItem`
```ts
interface QuestionItem {
  question: string;
  primaryType: EnneagramType;      // 1–9
  secondaryType: EnneagramType;    // 1–9
  trait: string;                    // e.g. "Leadership"
  winnerPoints: number;             // typically 3
  secondaryPoints: number;          // typically 2
  nomineePoints: number;            // typically 1
}
```

## `Person`
```ts
interface Person {
  id: string;                                    // lowercased name
  name: string;
  wins: number;
  nominations: number;
  scores: Record<EnneagramType, number>;
}
```

## `EventState`
```ts
interface EventState {
  screen: "welcome" | "question" | "nominees" | "winner"
        | "results" | "type-detail" | "chemistry" | "summary";
  questions: QuestionItem[];
  currentIndex: number;
  nominees: { red: string; blue: string; green: string };
  winnerColor: "red" | "blue" | "green" | null;
  people: Record<string, Person>;
  selectedType: EnneagramType | null;
  updatedAt: number;
}
```

## Scoring Rules
On `showWinner`:
- Winner nominee:
  - `+winnerPoints` to `primaryType`
  - `+secondaryPoints` to `secondaryType`
  - `+1` win
- Losing nominees:
  - `+nomineePoints` to `primaryType`
  - `+nomineePoints` to `secondaryType`
- On `showNominees`, each nominated name gets `+1 nomination`.

## Leading / Second Type
`leadingTypes(scores)` returns the top two scoring types with positive scores.

## `ExportBundle`
```ts
interface ExportBundle {
  version: string;      // "1.0"
  exportedAt: string;   // ISO timestamp
  state: EventState;
  derived: {
    distribution: Record<EnneagramType, number>;
    people: Array<{ name; wins; nominations; scores; leading; second }>;
    chemistry: ChemistryReport;
    funFacts: string[];
  };
}
```

Importable via `importBundle(rawJson)` — accepts either the full bundle or a bare `EventState`.
