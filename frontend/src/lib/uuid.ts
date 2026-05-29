// uuid.ts - Context-agnostic UUID generator.
// Falls back to a manual v4 when crypto.randomUUID is unavailable (e.g. non-secure
// contexts such as raw IP origins), which is common in the Tauri/LAN deployment.
export const uuidv4 = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
