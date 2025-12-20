const baseURL = import.meta.env.VITE_BASE_URL;

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'moderator';
}

export interface AdminAuthResponse {
  message: string;
  accessToken: string;
  admin: Admin;
}

export interface Debate {
  id: string;
  userId: string;
  email: string;
  topic: string;
  result: string;
  date: string;
  opponentEmail?: string;
}

export interface Comment {
  id: string;
  type: string;
  content: string;
  userId: string;
  userEmail: string;
  displayName: string;
  debateId?: string;
  teamId?: string;
  createdAt: string;
  isDeleted: boolean;
}

export interface Analytics {
  totalDebates: number;
  activeUsers: number;
  totalComments: number;
  totalUsers: number;
  debatesToday: number;
  commentsToday: number;
  newUsersToday: number;
  timestamp: string;
}

export interface AnalyticsSnapshot {
  id: string;
  timestamp: string;
  totalDebates: number;
  activeUsers: number;
  totalComments: number;
  totalUsers: number;
  debatesToday: number;
  commentsToday: number;
  newUsersToday: number;
}

export interface AdminActionLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
  timestamp: string;
  details?: Record<string, any>;
}

// Admin Authentication
// Note: Admin signup is disabled - credentials must be added manually to the database
export const adminLogin = async (
  email: string,
  password: string
): Promise<AdminAuthResponse> => {
  const response = await fetch(`${baseURL}/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to login');
  }
  return response.json();
};

// Analytics
export const getAnalytics = async (token: string): Promise<Analytics> => {
  const response = await fetch(`${baseURL}/admin/analytics`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }
  return response.json();
};

export const getAnalyticsHistory = async (
  token: string,
  days: number = 7
): Promise<{ snapshots: AnalyticsSnapshot[]; days: number }> => {
  const response = await fetch(
    `${baseURL}/admin/analytics/history?days=${days}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch analytics history');
  }
  return response.json();
};

// Debates
export const getDebates = async (
  token: string,
  page: number = 1,
  limit: number = 20
): Promise<{ debates: Debate[]; total: number; page: number; limit: number }> => {
  const response = await fetch(
    `${baseURL}/admin/debates?page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch debates');
  }
  return response.json();
};

export const deleteDebate = async (
  token: string,
  debateId: string
): Promise<void> => {
  const response = await fetch(`${baseURL}/admin/debates/${debateId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to delete debate');
  }
};

export const bulkDeleteDebates = async (
  token: string,
  ids: string[]
): Promise<void> => {
  const response = await fetch(`${baseURL}/admin/debates/bulk`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete debates');
  }
};

// Comments
export const getComments = async (
  token: string,
  page: number = 1,
  limit: number = 20
): Promise<{ comments: Comment[]; total: number; page: number; limit: number }> => {
  const response = await fetch(
    `${baseURL}/admin/comments?page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch comments');
  }
  return response.json();
};

export const deleteComment = async (
  token: string,
  commentId: string,
  type: string
): Promise<void> => {
  const response = await fetch(
    `${baseURL}/admin/comments/${commentId}?type=${type}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error('Failed to delete comment');
  }
};

export const bulkDeleteComments = async (
  token: string,
  ids: string[],
  type: string
): Promise<void> => {
  const response = await fetch(`${baseURL}/admin/comments/bulk`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ids, type }),
  });
  if (!response.ok) {
    throw new Error('Failed to delete comments');
  }
};

// Admin Action Logs
export const getAdminActionLogs = async (
  token: string,
  page: number = 1,
  limit: number = 50
): Promise<{ logs: AdminActionLog[]; total: number; page: number; limit: number }> => {
  const response = await fetch(
    `${baseURL}/admin/logs?page=${page}&limit=${limit}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error('Failed to fetch admin logs');
  }
  return response.json();
};

