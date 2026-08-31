const BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:5000/api/v1';

class ApiClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  getToken() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('blackbox_access_token');
    }
    return null;
  }

  setToken(token) {
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('blackbox_access_token', token);
      } else {
        localStorage.removeItem('blackbox_access_token');
      }
    }
  }

  getRefreshToken() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('blackbox_refresh_token');
    }
    return null;
  }

  setRefreshToken(token) {
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('blackbox_refresh_token', token);
      } else {
        localStorage.removeItem('blackbox_refresh_token');
      }
    }
  }

  clearTokens() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('blackbox_access_token');
      localStorage.removeItem('blackbox_refresh_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      options.body = JSON.stringify(options.body);
    }

    // Don't set Content-Type header if body is FormData (let browser set multipart boundary)
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const error = data?.error || {
          code: `HTTP_${res.status}`,
          message: data?.message || res.statusText || 'An error occurred during the request'
        };
        throw error;
      }

      return data;
    } catch (error) {
      if (error.code) {
        throw error;
      }
      throw {
        code: 'NETWORK_ERROR',
        message: error.message || 'Unable to communicate with BlackBox server'
      };
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
