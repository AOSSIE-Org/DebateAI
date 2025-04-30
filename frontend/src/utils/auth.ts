export const setAuthToken = (token: string) => {
    localStorage.setItem("token", token);
  };
  
  export const getAuthToken = (): string | null => {
    return localStorage.getItem("token");
  };
  
  export const clearAuthToken = () => {
    localStorage.removeItem("token");
  };