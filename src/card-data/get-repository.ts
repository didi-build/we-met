import { D1CardRepository } from "@/card-data/d1-repository";
import { registerBuiltInLeadSinkKinds } from "@/card-data/register-lead-sink-kinds";
import type { CardRepository } from "@/card-data/repository";

export function createCardRepositoryFromD1(db: D1Database): CardRepository {
  registerBuiltInLeadSinkKinds();
  return new D1CardRepository(db);
}
