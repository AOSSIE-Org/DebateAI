import { getServer } from "@/lib/server";

const config = {
  get baseUrl(): string | null {
    return getServer();
  },
};

export default config;
