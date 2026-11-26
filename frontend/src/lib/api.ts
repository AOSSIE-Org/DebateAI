import axios from 'axios';
import { getServer, isOfficial } from './server';

const api = axios.create();

api.interceptors.request.use((cfg) => {
  const base = getServer();
  if (!base) {
    const msg = 'The custom server URL is invalid. Fix it, or switch to the official server.';
    return Promise.reject(Object.assign(new Error(msg), { userMessage: msg }));
  }
  cfg.baseURL = base;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const base = getServer();
    if (!err.response && base && !isOfficial()) {
      err.userMessage = `Couldn't reach ${new URL(base).host}. Check the server URL and try again.`;
    }
    return Promise.reject(err);
  }
);

export default api;
