import { useCallback } from 'react';
import { useCompanyContext } from './useCompanyContext';

export function useCompanyQuery() {
  const { activeCompanyId } = useCompanyContext();

  /**
   * Fetch with automatic company_id parameter
   * Example: query('/api/employees') → 'GET /api/employees?company_id=...'
   */
  const query = useCallback(
    async <T = any>(
      endpoint: string,
      options: RequestInit = {}
    ): Promise<T> => {
      if (!activeCompanyId) {
        throw new Error('No active company. Cannot make company-scoped query.');
      }

      // Append company_id to URL
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = `${endpoint}${separator}company_id=${activeCompanyId}`;

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (response.status === 401) {
          throw new Error('Unauthorized: No access to this company');
        }

        if (response.status === 403) {
          throw new Error('Forbidden: You do not have permission to access this company');
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      } catch (error) {
        console.error('[useCompanyQuery]', endpoint, error);
        throw error;
      }
    },
    [activeCompanyId]
  );

  /**
   * GET request with company_id
   */
  const get = useCallback(
    async <T = any>(endpoint: string): Promise<T> => {
      return query<T>(endpoint, { method: 'GET' });
    },
    [query]
  );

  /**
   * POST request with company_id
   */
  const post = useCallback(
    async <T = any>(endpoint: string, body: any): Promise<T> => {
      return query<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    [query]
  );

  /**
   * PUT request with company_id
   */
  const put = useCallback(
    async <T = any>(endpoint: string, body: any): Promise<T> => {
      return query<T>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    [query]
  );

  /**
   * DELETE request with company_id
   */
  const delete_ = useCallback(
    async <T = any>(endpoint: string): Promise<T> => {
      return query<T>(endpoint, { method: 'DELETE' });
    },
    [query]
  );

  return {
    query,
    get,
    post,
    put,
    delete: delete_,
    activeCompanyId,
  };
}
