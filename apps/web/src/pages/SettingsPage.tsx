import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import ChipInput from "../components/ChipInput";
import { useSession } from "../hooks/useSession";
import { useApiClient } from "../lib/apiClient";
import type { StyleProfile } from "@pulse-kit/shared";

const STYLE_STORAGE_KEY = "pulse-kit-style-profile";

const defaultProfile: StyleProfile = {
  voice: "Analytical, optimistic operator",
  cadence: "Fast tempo with reflective beats",
  sentence_length: "Short bursts with occasional expansion",
  favorite_phrases: ["ship it", "zoom out", "builders"],
  banned_words: ["cringe", "synergy"],
};

const loadProfile = (): StyleProfile => {
  if (typeof window === "undefined") return defaultProfile;
  try {
    const stored = window.localStorage.getItem(STYLE_STORAGE_KEY);
    if (!stored) return defaultProfile;
    return { ...defaultProfile, ...(JSON.parse(stored) as Partial<StyleProfile>) };
  } catch (error) {
    return defaultProfile;
  }
};

const SettingsPage = () => {
  const api = useApiClient();
  const { session, setSession } = useSession();
  const [styleProfile, setStyleProfile] = useState<StyleProfile>(loadProfile);
  const [model, setModel] = useState<"openai" | "xai">("openai");
  const [wantTrends, setWantTrends] = useState(false);
  const [trendSourcesMax, setTrendSourcesMax] = useState(1);
  const [openaiKey, setOpenaiKey] = useState("");
  const [xaiKey, setXaiKey] = useState("");
  const [xKey, setXKey] = useState("");

  const styleProfileChanged = useMemo(() => JSON.stringify(styleProfile), [styleProfile]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!session.userId) {
        throw new Error("No authenticated session");
      }

      const response = await api.post("auth/refresh", {
        json: {
          user_id: session.userId,
          handle: session.handle ?? session.userId,
          settings: {
            model,
            want_trends: wantTrends,
            trend_sources_max: trendSourcesMax,
          },
        },
      });
      return (await response.json()) as { token: string; expires_in: number };
    },
    onSuccess: (payload) => {
      if (session.userId) {
        setSession({
          userId: session.userId,
          handle: session.handle,
          token: payload.token,
          expiresAt: Date.now() + payload.expires_in * 1000,
        });
      }
    },
  });

  const saveKeys = useMutation({
    mutationFn: async () => {
      const keys = [
        openaiKey ? { provider: "openai" as const, value: openaiKey } : null,
        xaiKey ? { provider: "xai" as const, value: xaiKey } : null,
        xKey ? { provider: "x" as const, value: xKey } : null,
      ].filter(Boolean);

      if (keys.length === 0) {
        return;
      }

      await api.post("keys/save", {
        json: {
          keys,
        },
      });
    },
    onSuccess: () => {
      setOpenaiKey("");
      setXaiKey("");
      setXKey("");
    },
  });

  const handleCopyToken = async () => {
    if (!session.token) return;
    await navigator.clipboard.writeText(session.token);
  };

  const handleProfileChange = <K extends keyof StyleProfile>(field: K, value: StyleProfile[K]) => {
    const next = { ...styleProfile, [field]: value };
    setStyleProfile(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(next));
    }
  };

  return (
    <Stack spacing={4}>
      <Card sx={{ backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h5" fontWeight={600}>
                Style Profile
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tune the voice that IdeaEngine and ReplyCopilot will honor. These settings stay client-side until you trigger a generation.
              </Typography>
            </Stack>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Voice"
                  value={styleProfile.voice}
                  onChange={(event) => handleProfileChange("voice", event.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Cadence"
                  value={styleProfile.cadence}
                  onChange={(event) => handleProfileChange("cadence", event.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Sentence Length"
                  value={styleProfile.sentence_length}
                  onChange={(event) => handleProfileChange("sentence_length", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <ChipInput
                  label="Favorite Phrases"
                  values={styleProfile.favorite_phrases}
                  onChange={(next) => handleProfileChange("favorite_phrases", next)}
                  placeholder="Press Enter to add"
                />
              </Grid>
              <Grid item xs={12}>
                <ChipInput
                  label="Banned Words"
                  values={styleProfile.banned_words}
                  onChange={(next) => handleProfileChange("banned_words", next)}
                  placeholder="Words to avoid"
                />
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h5" fontWeight={600}>
                Model & Trend Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose your default model and trend-spark behavior. The extension will mirror these defaults.
              </Typography>
            </Stack>
            <FormControl>
              <FormLabel>Preferred Model</FormLabel>
              <RadioGroup row value={model} onChange={(event) => setModel(event.target.value as "openai" | "xai") }>
                <FormControlLabel value="openai" control={<Radio />} label="OpenAI" />
                <FormControlLabel value="xai" control={<Radio />} label="xAI" />
              </RadioGroup>
            </FormControl>
            <Stack direction="row" alignItems="center" spacing={2}>
              <FormControlLabel
                control={<Switch checked={wantTrends} onChange={(event) => setWantTrends(event.target.checked)} />}
                label="Include Today’s Sparks"
              />
              <Typography variant="body2" color="text.secondary">
                When enabled, ReplyCopilot & IdeaEngine will request live sparks up to your limit below.
              </Typography>
            </Stack>
            <Box>
              <Typography gutterBottom variant="body2" color="text.secondary">
                Trend sources per request: {trendSourcesMax}
              </Typography>
              <Slider
                value={trendSourcesMax}
                onChange={(_, value) => setTrendSourcesMax(value as number)}
                step={1}
                marks
                min={0}
                max={2}
              />
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="contained"
                onClick={() => saveSettings.mutate()}
                disabled={saveSettings.isPending}
              >
                Save Preferences
              </Button>
              {saveSettings.isSuccess && <Alert severity="success">Preferences saved.</Alert>}
              {saveSettings.isError && <Alert severity="error">Could not save preferences.</Alert>}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h5" fontWeight={600}>
                Bring Your Own Keys
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Stored securely via Supabase with AES-GCM encryption. Keys never touch the extension.
              </Typography>
            </Stack>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="OpenAI API Key"
                  value={openaiKey}
                  onChange={(event) => setOpenaiKey(event.target.value)}
                  fullWidth
                  placeholder="sk-..."
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="xAI API Key"
                  value={xaiKey}
                  onChange={(event) => setXaiKey(event.target.value)}
                  fullWidth
                  placeholder="xai-..."
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="X API Bearer"
                  value={xKey}
                  onChange={(event) => setXKey(event.target.value)}
                  fullWidth
                  placeholder="Bearer ..."
                />
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button variant="outlined" onClick={() => saveKeys.mutate()} disabled={saveKeys.isPending}>
                Save Keys
              </Button>
              {saveKeys.isSuccess && <Alert severity="success">Keys updated.</Alert>}
              {saveKeys.isError && <Alert severity="error">Unable to store keys.</Alert>}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ backgroundColor: "rgba(17,22,29,0.85)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={600}>
              Extension Token
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Copy the current short-lived token for the Chrome extension. Tokens auto-refresh when the extension pings the API.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
              <TextField
                label="Token"
                value={session.token ?? "No token"}
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <Button variant="contained" onClick={handleCopyToken} disabled={!session.token}>
                Copy token
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default SettingsPage;
