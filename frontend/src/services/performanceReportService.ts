import { getAuthToken } from '@/utils/auth';
import { PerformanceReport, PerformanceReportRequest } from '@/types/performanceReport';

const baseURL =
  import.meta.env.VITE_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:1313" : "");

export const getOrGeneratePerformanceReport = async (
  request: PerformanceReportRequest
): Promise<PerformanceReport> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseURL}/debate/performance-report`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.details || errorData.error || `Failed to fetch performance report: ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.report;
};

export const getPerformanceReportById = async (
  debateId: string
): Promise<PerformanceReport> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseURL}/debate/${encodeURIComponent(debateId)}/performance-report`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.details || errorData.error || `Failed to fetch performance report: ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.report;
};
