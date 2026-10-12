import { getServer } from "@/lib/server";

const config = {
  get baseUrl(): string | null {
    try {
      return getServer();
    } catch {
      return null;
    }
  },
};

export default config;
