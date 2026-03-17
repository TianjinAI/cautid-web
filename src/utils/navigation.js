/**
 * Navigation Adapter - Replaces wx.navigateTo/wx.navigateBack
 * Uses Vue Router for navigation
 */

import { useRouter } from 'vue-router';

export const useNavigation = () => {
  const router = useRouter();

  return {
    /**
     * Navigate to a new page (equivalent to wx.navigateTo)
     * @param {string} path - Target path
     */
    navigateTo: (path) => {
      router.push(path);
    },

    /**
     * Go back (equivalent to wx.navigateBack)
     */
    navigateBack: () => {
      router.back();
    },

    /**
     * Replace current page (equivalent to wx.redirectTo)
     * @param {string} path - Target path
     */
    redirectTo: (path) => {
      router.replace(path);
    },

    /**
     * Switch tab (equivalent to wx.switchTab)
     * @param {string} path - Target tab path
     */
    switchTab: (path) => {
      router.push(path);
    }
  };
};

export default useNavigation;
