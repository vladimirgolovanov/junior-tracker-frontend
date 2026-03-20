import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { useAuthStore } from "../store/auth";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const client = createClient<paths>({ baseUrl: API_BASE });

client.use({
  async onRequest({ request }) {
    const token = useAuthStore.getState().token;
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      useAuthStore.getState().logout();
    }
    return response;
  },
});

export default client;
