import type { BourbonCardsYaml } from "./render-yaml-game-docs";

export type BourbonCardsYamlV1 = BourbonCardsYaml & {
  kind: "bourbon_cards_v1";
};

export function isBourbonCardsYamlV1(data: unknown): data is BourbonCardsYamlV1 {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { kind?: string }).kind === "bourbon_cards_v1" &&
    Array.isArray((data as BourbonCardsYaml).cards)
  );
}

export function parseBourbonCardsYamlV1(data: unknown): BourbonCardsYamlV1 {
  if (!isBourbonCardsYamlV1(data)) {
    throw new Error('Expected kind: "bourbon_cards_v1" and a cards array');
  }
  return data;
}
