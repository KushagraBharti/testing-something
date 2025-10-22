import ky, { KyInstance } from "ky";
import { useMemo } from "react";
import { useSession } from "../hooks/useSession";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

export const useApiClient = (): KyInstance => {
  const { session } = useSession();

  return useMemo(
    () =>
      ky.create({
        prefixUrl: baseUrl,
        headers: {
          "Content-Type": "application/json",
        },
        hooks: {
          beforeRequest: [
            (request) => {
              if (session.token) {
                request.headers.set("Authorization", `Bearer ${session.token}`);
              }
            },
          ],
        },
      }),
    [session.token],
  );
};

export const apiBaseUrl = baseUrl;
