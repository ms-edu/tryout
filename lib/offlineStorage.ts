// lib/offlineStorage.ts
import { openDB, DBSchema, IDBPDatabase } from "idb";

interface CbtDB extends DBSchema {
  pending_answers: {
    key: string;
    value: {
      id: string;
      attempt_id: string;
      question_id: string;
      selected_option: string | null;
      timestamp: number;
      synced: boolean;
    };
    indexes: { by_attempt: string };
  };
  exam_cache: {
    key: string;
    value: {
      attempt_id: string;
      data: any;
      cached_at: number;
    };
  };
}

let db: IDBPDatabase<CbtDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<CbtDB>> {
  if (db) return db;
  db = await openDB<CbtDB>("tryout-cbt", 1, {
    upgrade(db) {
      const answerStore = db.createObjectStore("pending_answers", { keyPath: "id" });
      answerStore.createIndex("by_attempt", "attempt_id");
      db.createObjectStore("exam_cache", { keyPath: "attempt_id" });
    },
  });
  return db;
}

export async function savePendingAnswer(
  attemptId: string,
  questionId: string,
  selectedOption: string | null
): Promise<void> {
  const database = await getDB();
  const id = `${attemptId}_${questionId}`;
  await database.put("pending_answers", {
    id,
    attempt_id: attemptId,
    question_id: questionId,
    selected_option: selectedOption,
    timestamp: Date.now(),
    synced: false,
  });
}

export async function getPendingAnswers(attemptId: string) {
  const database = await getDB();
  return database.getAllFromIndex("pending_answers", "by_attempt", attemptId);
}

export async function markAnswerSynced(id: string): Promise<void> {
  const database = await getDB();
  const record = await database.get("pending_answers", id);
  if (record) {
    await database.put("pending_answers", { ...record, synced: true });
  }
}

export async function clearPendingAnswers(attemptId: string): Promise<void> {
  const database = await getDB();
  const tx = database.transaction("pending_answers", "readwrite");
  const index = tx.store.index("by_attempt");
  const keys = await index.getAllKeys(attemptId);
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}

export async function cacheExamData(attemptId: string, data: any): Promise<void> {
  const database = await getDB();
  await database.put("exam_cache", { attempt_id: attemptId, data, cached_at: Date.now() });
}

export async function getCachedExamData(attemptId: string) {
  const database = await getDB();
  return database.get("exam_cache", attemptId);
}
