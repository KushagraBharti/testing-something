import { useMutation } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { useApiClient, apiBaseUrl } from "../lib/apiClient";

const LoginPage = () => {
  const api = useApiClient();
  const { setSession } = useSession();
  const navigate = useNavigate();

  const demoLogin = useMutation({
    mutationFn: async () => {
      const response = await api.post("auth/refresh", {
        json: {
          user_id: "demo-user",
          handle: "demo_creator",
          settings: {
            model: "openai",
            want_trends: false,
            trend_sources_max: 1,
          },
        },
      });
      return (await response.json()) as { token: string; expires_in: number };
    },
    onSuccess: (payload) => {
      setSession({
        userId: "demo-user",
        handle: "demo_creator",
        token: payload.token,
        expiresAt: Date.now() + payload.expires_in * 1000,
      });
      navigate("/settings");
    },
  });

  const handleOAuth = () => {
    window.location.href = `${apiBaseUrl}/auth/x/start`;
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "70vh" }}>
      <Card sx={{ width: 520, backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.06)" }}>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h4" fontWeight={600}>
                IdeaEngine + ReplyCopilot
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Connect your X account to sync style settings, manage trend sparks, and issue short-lived tokens for the Chrome extension.
              </Typography>
            </Stack>
            {demoLogin.isError && <Alert severity="error">Failed to mint a demo session. Check API connectivity.</Alert>}
            <Stack spacing={2}>
              <Button variant="contained" size="large" onClick={handleOAuth}>
                Login with X
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => demoLogin.mutate()}
                disabled={demoLogin.isPending}
              >
                Use Demo Session
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              We never post without permission. Tokens are short lived and can be revoked anytime from Settings.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
