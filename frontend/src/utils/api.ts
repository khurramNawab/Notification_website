const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('paytrack_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function request(endpoint: string, options: RequestInit = {}) {
  const headers = getHeaders();
  
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error: ${response.statusText}`);
  }

  // Check if response is a file (blob)
  const contentType = response.headers.get('Content-Type');
  if (
    contentType &&
    (contentType.includes('pdf') ||
      contentType.includes('sheet') ||
      contentType.includes('vnd.openxmlformats-officedocument') ||
      contentType.includes('octet-stream'))
  ) {
    return response.blob();
  }

  return response.json();
}
