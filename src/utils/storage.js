/**
 * Storage Adapter - Replaces wx.setStorageSync/wx.getStorageSync
 */

export const storage = {
  /**
   * Set item to localStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be JSON.stringify'd)
   */
  setSync(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage setSync error:', e);
      return false;
    }
  },

  /**
   * Get item from localStorage
   * @param {string} key - Storage key
   * @returns {any} Parsed value or null
   */
  getSync(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Storage getSync error:', e);
      return null;
    }
  },

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   */
  removeSync(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage removeSync error:', e);
    }
  },

  /**
   * Clear all localStorage
   */
  clearSync() {
    try {
      localStorage.clear();
    } catch (e) {
      console.error('Storage clearSync error:', e);
    }
  }
};

export default storage;
