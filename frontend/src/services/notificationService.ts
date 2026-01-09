const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1313';

export interface Notification {
  id: string;
  userId: string;
  type: 'comment' | 'badge' | 'tournament' | 'leaderboard' | 'system';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export const getNotifications = async (): Promise<Notification[]> => {
  const token = localStorage.getItem('token');
  if (!token) return [];
  
  try {
    const response = await fetch(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return await response.json();
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    await fetch(`${API_URL}/notifications/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

export const deleteNotification = async (id: string): Promise<void> => {
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    await fetch(`${API_URL}/notifications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};
