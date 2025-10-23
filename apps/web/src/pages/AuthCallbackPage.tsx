import { useEffect, useMemo } from "react";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useApiClient } from "../lib/apiClient";
import { useSession } from "../hooks/useSession";

const AuthCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const api = useApiClient();
  const { setSession } = useSession();
  const sessionToken = params.get("session_token") ?? import.meta.env.VITE_SESSION_TOKEN_SECRET;

  const exchange = useMutation({
    mutationFn: async (code: string) => {
      const response = await api.post("auth/refresh", {
        json: {
          user_id: params.get("user_id") ?? `user-${Date.now()}`,
          handle: params.get("handle") ?? "creator",
          session_token: sessionToken,
          settings: {
            model: "openai",
            want_trends: false,
            trend_sources_max: 1,
          },
        },
      });
      return (await response.json()) as {
        token: string;
        refresh_token: string;
        expires_in: number;
        analytics_enabled?: boolean;
      };
    },
    onSuccess: (payload) => {
      setSession({
        userId: params.get("user_id") ?? "user",
        handle: params.get("handle") ?? "creator",
        token: payload.token,
        refreshToken: payload.refresh_token,
        expiresAt: Date.now() + payload.expires_in * 1000,
      });
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: "pulse:setAnalytics",
          enabled: payload.analytics_enabled ?? false,
        });
      }
    },
  });

  const queryToken = params.get("token");
  const queryRefresh = params.get("refresh_token");

  useEffect(() => {
    if (queryToken) {
      setSession({
        userId: params.get("user_id") ?? "user",
        handle: params.get("handle") ?? "creator",
        token: queryToken,
        refreshToken: queryRefresh ?? null,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: "pulse:setAnalytics", enabled: false });
      }
    } else {
      const code = params.get("code");
      if (code && !exchange.isPending && !exchange.isSuccess && !exchange.isError) {
        exchange.mutate(code);
      }
    }
  }, [queryToken, queryRefresh, params, exchange, setSession]);

  const status = useMemo(() => {
    if (queryToken || exchange.isSuccess) return "success" as const;
    if (exchange.isError) return "error" as const;
    return "loading" as const;
  }, [queryToken, exchange.isSuccess, exchange.isError]);

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Card sx={{ maxWidth: 520, width: "100%", backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
        <CardContent>
          <Stack spacing={3} alignItems="center">
            <Typography variant="h5" fontWeight={600}>
              Linking Extension
            </Typography>
            {status === "loading" && <CircularProgress size={32} />}
            {status === "error" && (
              <Alert severity="error" sx={{ width: "100%" }}>
                Something went wrong exchanging your session. Retry login from the dashboard.
              </Alert>
            )}
            {status === "success" && (
              <Alert severity="success" sx={{ width: "100%" }}>
                Session ready. You can grab the extension token from Settings.
              </Alert>
            )}
            <Button
              variant="contained"
              onClick={() => navigate("/settings")}
              disabled={status === "loading"}
            >
              Continue to Settings
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuthCallbackPage;
