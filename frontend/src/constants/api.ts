export const API_BASE_URL = (
  import.meta.env.VITE_BASE_URL || "http://localhost:1313"
).replace(/\/+$/, "");

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
