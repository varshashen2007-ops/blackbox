import { writable } from 'svelte/store';
import { api } from '../api/client.js';

function createAuthStore() {
  const { subscribe, set, update } = writable({
    user: null,
    isAuthenticated: false,
    loading: true
  });

  return {
    subscribe,
    setUser: (user) => {
      update((state) => ({
        ...state,
        user,
        isAuthenticated: !!user,
        loading: false
      }));
    },
    logout: () => {
      api.clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        loading: false
      });
    },
    setLoading: (loading) => {
      update((state) => ({ ...state, loading }));
    }
  };
}

export const auth = createAuthStore();
