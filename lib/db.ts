// ============================================================
// IndexedDB 持久化层
// 存储: 用户上传文件(含解析数据)、任务文件选择、操作历史
// ============================================================

import { WorkbenchFile, HistoryItem } from './types';

const DB_NAME = 'workbench';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ===== 文件 =====

export async function saveFile(wf: WorkbenchFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(wf);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFiles(): Promise<WorkbenchFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== 元数据 (任务文件选择、历史记录) =====

interface AppMeta {
  key: string;
  value: any;
}

async function saveMeta(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadMeta(key: string): Promise<any | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}

import type { TaskSheetRef } from './types';

export async function saveTaskFileIds(ids: TaskSheetRef[]): Promise<void> {
  await saveMeta('taskFileIds', ids);
}

export async function loadTaskFileIds(): Promise<TaskSheetRef[]> {
  return (await loadMeta('taskFileIds')) ?? [];
}

export async function saveHistory(history: HistoryItem[]): Promise<void> {
  await saveMeta('history', history);
}

export async function loadHistory(): Promise<HistoryItem[]> {
  return (await loadMeta('history')) ?? [];
}
