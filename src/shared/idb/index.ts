import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface SurveyRecord {
  id?: number;
  selectedZone: string;
  selectedBuilding: string;
  selectedRoom: string;
  equipmentType: string;
  conditionRating: number;
  notes: string;
  photoBlob?: Blob | null; // Lưu Blob để tránh Out of Memory
  syncStatus: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  is_syncing?: boolean; // Khóa lạc quan (Optimistic Locking)
  createdAt: number;
}

interface SurveyDB extends DBSchema {
  surveys: {
    key: number;
    value: SurveyRecord;
    indexes: { 'by-syncStatus': string };
  };
}

let dbPromise: Promise<IDBPDatabase<SurveyDB>>;

/**
 * Khởi tạo IndexedDB
 */
export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<SurveyDB>('SurveyDB', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('surveys')) {
          const store = db.createObjectStore('surveys', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-syncStatus', 'syncStatus');
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Hàm tiện ích: Chuyển Base64 sang Blob
 * @param base64 Chuỗi base64 (không bao gồm tiền tố data:image/jpeg;base64,)
 * @param contentType Loại MIME của file ảnh
 */
export const base64ToBlob = (base64: string, contentType = 'image/jpeg'): Blob => {
  // Loại bỏ tiền tố nếu có
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(base64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
};

/**
 * Lưu bản nháp vào IndexedDB (Trạng thái PENDING_SYNC)
 */
export const saveSurveyDraft = async (
  surveyData: Omit<SurveyRecord, 'id' | 'syncStatus' | 'createdAt' | 'photoBlob'>,
  photoBase64?: string | null
) => {
  const db = await initDB();
  
  let photoBlob: Blob | null = null;
  if (photoBase64) {
    photoBlob = base64ToBlob(photoBase64);
  }

  const newRecord: SurveyRecord = {
    ...surveyData,
    photoBlob,
    syncStatus: 'PENDING_SYNC',
    createdAt: Date.now(),
  };

  const tx = db.transaction('surveys', 'readwrite');
  const store = tx.objectStore('surveys');
  await store.add(newRecord);
  await tx.done;
};

/**
 * Lấy các bản ghi đang chờ đồng bộ và áp dụng Khóa lạc quan (is_syncing = true)
 */
export const getAndLockPendingSurveys = async (): Promise<SurveyRecord[]> => {
  const db = await initDB();
  const tx = db.transaction('surveys', 'readwrite');
  const store = tx.objectStore('surveys');
  const index = store.index('by-syncStatus');
  
  const pendingRecords = await index.getAll('PENDING_SYNC');
  const recordsToSync: SurveyRecord[] = [];

  for (const record of pendingRecords) {
    if (!record.is_syncing) {
      record.is_syncing = true;
      await store.put(record);
      recordsToSync.push(record);
    }
  }
  
  await tx.done;
  return recordsToSync;
};

/**
 * Cập nhật trạng thái sau khi đồng bộ
 */
export const updateSurveyStatus = async (id: number, status: 'SYNCED' | 'FAILED', unlock: boolean = false) => {
  const db = await initDB();
  const tx = db.transaction('surveys', 'readwrite');
  const store = tx.objectStore('surveys');
  const record = await store.get(id);
  
  if (record) {
    record.syncStatus = status;
    if (unlock) {
      record.is_syncing = false;
    }
    await store.put(record);
  }
  await tx.done;
};

/**
 * Gỡ khóa (Deadlock Recovery) cho các bản ghi kẹt is_syncing quá 5 phút
 */
export const unlockStuckRecords = async () => {
  const db = await initDB();
  const tx = db.transaction('surveys', 'readwrite');
  const store = tx.objectStore('surveys');
  const index = store.index('by-syncStatus');
  
  const pendingRecords = await index.getAll('PENDING_SYNC');
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const now = Date.now();
  let unlockedCount = 0;

  for (const record of pendingRecords) {
    if (record.is_syncing && (now - record.createdAt > FIVE_MINUTES_MS)) {
      record.is_syncing = false;
      await store.put(record);
      unlockedCount++;
    }
  }
  
  await tx.done;
  if (unlockedCount > 0) {
    console.log(`Đã gỡ khóa thành công ${unlockedCount} bản ghi bị kẹt (Deadlock).`);
  }
};

