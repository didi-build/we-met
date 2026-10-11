import { D1CardRepository } from "@/card-data/d1-repository";
import type { CardRepository } from "@/card-data/repository";

export function createCardRepositoryFromD1(db: D1Database): CardRepository {
  return new D1CardRepository(db);
}
