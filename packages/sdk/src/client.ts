export interface ClientConfig {
  baseUrl: string;
  tenantId?: string;
  getAuthToken?: () => Promise<string> | string;
  onError?: (error: ApiError) => void;
  onRequest?: (request: RequestInit) => RequestInit;
  onResponse?: (response: Response) => void;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeout?: number;
}

export class FoundationClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (this.config.tenantId) {
      headers['X-Tenant-Id'] = this.config.tenantId;
    }

    if (this.config.getAuthToken) {
      const token = await this.config.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let init: RequestInit = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: options?.signal,
    };

    if (this.config.onRequest) {
      init = this.config.onRequest(init);
    }

    // Handle timeout
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (options?.timeout) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), options.timeout);
      init.signal = controller.signal;
    }

    try {
      const response = await fetch(url, init);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (this.config.onResponse) {
        this.config.onResponse(response);
      }

      if (!response.ok) {
        const error = await this.parseError(response);
        if (this.config.onError) {
          this.config.onError(error);
        }
        throw error;
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return undefined as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (error instanceof Error && error.name === 'AbortError') {
        const apiError: ApiError = {
          code: 'TIMEOUT',
          message: 'Request timed out',
          status: 408,
        };
        if (this.config.onError) {
          this.config.onError(apiError);
        }
        throw apiError;
      }

      throw error;
    }
  }

  private async parseError(response: Response): Promise<ApiError> {
    const error: ApiError = {
      code: 'API_ERROR',
      message: response.statusText || 'An error occurred',
      status: response.status,
    };

    try {
      const body = await response.json();
      if (body.error) {
        error.code = body.error.code || error.code;
        error.message = body.error.message || error.message;
        error.details = body.error.details;
      } else if (body.code) {
        error.code = body.code;
        error.message = body.message || error.message;
        error.details = body.details;
      }
    } catch {
      // Ignore JSON parse errors
    }

    return error;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request('GET', path, undefined, options);
  }

  post<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request('POST', path, data, options);
  }

  put<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request('PUT', path, data, options);
  }

  patch<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request('PATCH', path, data, options);
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request('DELETE', path, undefined, options);
  }

  // File upload helper
  async upload(
    path: string,
    file: File | Blob,
    options?: RequestOptions & { fieldName?: string }
  ): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append(options?.fieldName || 'file', file);

    const headers: Record<string, string> = {
      ...options?.headers,
    };

    // Don't set Content-Type for FormData - browser will set it with boundary
    if (this.config.tenantId) {
      headers['X-Tenant-Id'] = this.config.tenantId;
    }

    if (this.config.getAuthToken) {
      const token = await this.config.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: options?.signal,
    });

    if (!response.ok) {
      throw await this.parseError(response);
    }

    return response.json();
  }

  setTenant(tenantId: string): void {
    this.config.tenantId = tenantId;
  }

  getConfig(): Readonly<ClientConfig> {
    return { ...this.config };
  }
}
