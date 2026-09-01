import { openDB } from 'idb';

const DB_NAME = 'rozgar_chat_media';
const DB_VERSION = 1;

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('voice_messages')) {
        db.createObjectStore('voice_messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('document_messages')) {
        db.createObjectStore('document_messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('call_logs')) {
        db.createObjectStore('call_logs', { keyPath: 'id' });
      }
    },
  });
}

export async function saveVoiceMessage(data) {
  const db = await initDB();
  return db.put('voice_messages', data);
}

export async function saveDocumentMessage(data) {
  const db = await initDB();
  return db.put('document_messages', data);
}

export async function saveCallLog(data) {
  const db = await initDB();
  return db.put('call_logs', data);
}

export async function getMediaForConversation(conversation_id) {
  const db = await initDB();
  
  const voices = await db.getAll('voice_messages');
  const docs = await db.getAll('document_messages');
  const calls = await db.getAll('call_logs');

  const filteredVoices = voices.filter(v => v.conversation_id === conversation_id);
  const filteredDocs = docs.filter(d => d.conversation_id === conversation_id);
  const filteredCalls = calls.filter(c => c.conversation_id === conversation_id);

  return [...filteredVoices, ...filteredDocs, ...filteredCalls];
}

export async function getAllCallLogs() {
  const db = await initDB();
  return db.getAll('call_logs');
}
