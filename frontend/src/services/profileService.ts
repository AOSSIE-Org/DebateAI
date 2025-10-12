const baseURL = import.meta.env.VITE_BASE_URL;

// Error types for better error handling
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

// Custom error class for API errors
export class ProfileServiceError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ProfileServiceError';
  }
}

// Helper function to handle API responses
const handleApiResponse = async <T>(response: Response): Promise<T> => {
  let responseBody;

  try {
    responseBody = await response.json();
  } catch (parseError) {
    // If response is not JSON, use text
    responseBody = { message: await response.text() };
  }

  if (!response.ok) {
    const errorMessage = responseBody.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new ProfileServiceError(errorMessage, response.status, responseBody.code);
  }

  return responseBody;
};

// Helper function to handle network errors
const handleNetworkError = (error: Error): never => {
  if (error instanceof ProfileServiceError) {
    throw error;
  }

  // Network or other errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    throw new ProfileServiceError('Network error: Please check your internet connection', undefined, 'NETWORK_ERROR');
  }

  throw new ProfileServiceError(`Unexpected error: ${error.message}`, undefined, 'UNKNOWN_ERROR');
};

export const getProfile = async (token: string): Promise<ApiResponse<any>> => {
  try {
    if (!token) {
      throw new ProfileServiceError('Authentication token is required', undefined, 'MISSING_TOKEN');
    }

    const response = await fetch(`${baseURL}/user/fetchprofile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await handleApiResponse(response);

    return {
      data,
      success: true,
    };
  } catch (error) {
    const apiError = error instanceof ProfileServiceError
      ? error
      : handleNetworkError(error as Error);

    return {
      error: {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
      },
      success: false,
    };
  }
};

export const updateProfile = async (
  token: string,
  displayName: string,
  bio: string,
  twitter?: string,
  instagram?: string,
  linkedin?: string,
  avatarUrl?: string
): Promise<ApiResponse<any>> => {
  try {
    if (!token) {
      throw new ProfileServiceError('Authentication token is required', undefined, 'MISSING_TOKEN');
    }

    if (!displayName?.trim()) {
      throw new ProfileServiceError('Display name is required', undefined, 'INVALID_INPUT');
    }

    const response = await fetch(`${baseURL}/user/updateprofile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName: displayName.trim(),
        bio: bio?.trim() || '',
        twitter: twitter?.trim(),
        instagram: instagram?.trim(),
        linkedin: linkedin?.trim(),
        avatarUrl: avatarUrl?.trim(),
      }),
    });

    const data = await handleApiResponse(response);

    return {
      data,
      success: true,
    };
  } catch (error) {
    const apiError = error instanceof ProfileServiceError
      ? error
      : handleNetworkError(error as Error);

    return {
      error: {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
      },
      success: false,
    };
  }
};

export const getLeaderboard = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await fetch(`${baseURL}/leaderboard`, {
      method: "GET",
    });

    const data = await handleApiResponse(response);

    // Validate that we received an array for leaderboard
    if (!Array.isArray(data)) {
      throw new ProfileServiceError('Invalid leaderboard response: expected array', undefined, 'INVALID_RESPONSE');
    }

    return {
      data,
      success: true,
    };
  } catch (error) {
    const apiError = error instanceof ProfileServiceError
      ? error
      : handleNetworkError(error as Error);

    return {
      error: {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
      },
      success: false,
    };
  }
};
