type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
};

export const getApiErrorMessage = async (
  response: Response,
  fallback: string
): Promise<string> => {
  try {
    const payload = (await response.json()) as ApiErrorPayload;

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Keep the caller's fallback when the response has no JSON error body.
  }

  return fallback;
};
