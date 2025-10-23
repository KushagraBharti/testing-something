import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { ThemeProvider, CssBaseline } from "@mui/material";
import {
  collectSnippetsWithDebug,
  extractTweetSnippet,
  inferPageContext,
  type IdeasResponse,
  type RepliesResponse,
  type SelectorDiagnostics,
  type StyleProfile,
} from "@pulse-kit/shared";
import theme from "../theme";
import { defaultStyleProfile } from "../../lib/defaultProfile";
import { insertText } from "../../lib/insertion";
import { STORAGE_KEYS, type ExtensionMessage, type ExtensionResponse } from "../../lib/messages";

const HOST_ELEMENT_ID = "pulse-kit-side-panel";

type TabKey = "ideas" | "replies";

type PageContext = ReturnType<typeof inferPageContext>;

type ToastState = { message: string; severity: "info" | "error" } | null;

const sendMessage = async <T,>(message: ExtensionMessage) =>
  new Promise<ExtensionResponse<T>>((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response as ExtensionResponse<T>);
    });
  });

const LoadingDot = () => (
  <Box
    sx={{
      width: 10,
      height: 10,
      borderRadius: "50%",
      bgcolor: "primary.main",
      animation: "pulse 1.2s ease-in-out infinite",
      "@keyframes pulse": {
        "0%": { opacity: 0.3, transform: "scale(0.9)" },
        "50%": { opacity: 1, transform: "scale(1.05)" },
        "100%": { opacity: 0.3, transform: "scale(0.9)" },
      },
    }}
  />
);

const closePanel = () => {
  const host = document.getElementById(HOST_ELEMENT_ID);
  host?.remove();
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: "pulse:resetLimiter" });
  }
};

const SidePanel = () => {
  const [tab, setTab] = useState<TabKey>("ideas");
  const [pageContext, setPageContext] = useState<PageContext>(inferPageContext(window.location.href));
  const [styleProfile, setStyleProfile] = useState<StyleProfile>(defaultStyleProfile);
  const [diagnostics, setDiagnostics] = useState<SelectorDiagnostics[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<IdeasResponse["ideas"]>([]);

  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [replies, setReplies] = useState<string[]>([]);

  useEffect(() => {
    sendMessage<null>({ type: "pulse:analyticsEvent", event: "panel_open" });
    return () => {
      sendMessage<null>({ type: "pulse:analyticsEvent", event: "panel_close" });
    };
  }, []);

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEYS.styleProfile], (value) => {
      const stored = value[STORAGE_KEYS.styleProfile] as StyleProfile | undefined;
      if (stored) {
        setStyleProfile({ ...defaultStyleProfile, ...stored });
      }
    });
  }, []);

  useEffect(() => {
    const updateContext = () => {
      setPageContext(inferPageContext(window.location.href));
    };

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function (...args) {
      originalPush.apply(this, args as Parameters<typeof history.pushState>);
      updateContext();
    } as typeof history.pushState;

    history.replaceState = function (...args) {
      originalReplace.apply(this, args as Parameters<typeof history.replaceState>);
      updateContext();
    } as typeof history.replaceState;

    window.addEventListener("popstate", updateContext);

    const observer = new MutationObserver(() => updateContext());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      history.pushState = originalPush;
      history.replaceState = originalReplace;
      window.removeEventListener("popstate", updateContext);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "i") {
        setTab("ideas");
        event.preventDefault();
      }
      if (event.altKey && event.key.toLowerCase() === "r") {
        setTab("replies");
        event.preventDefault();
      }
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const showToast = useCallback((message: string, severity: "info" | "error") => {
    setToast({ message, severity });
  }, []);

  const generateIdeas = useCallback(async () => {
    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const contextKey = pageContext === "mentions" ? "mentions" : "home";
      const { snippets, diagnostics: debug } = collectSnippetsWithDebug(document, contextKey, 30);
      setDiagnostics(debug);

      if (snippets.length === 0) {
        setShowDebug(true);
        showToast("No posts detected. Scroll the feed or reload.", "info");
        return;
      }

      setShowDebug(false);

      const response = await sendMessage<IdeasResponse>({
        type: "pulse:apiRequest",
        path: "ai/ideas",
        body: {
          snippets,
          style_profile: styleProfile,
          want_trends: false,
          niche: null,
          trend_sources_max: 1,
        },
      });

      if (!response.ok) {
        if (response.error === "Throttled") {
          showToast("Taking a breather before generating again.", "info");
          return;
        }
        if (response.error === "rate_limited") {
          showToast("Hour limit reached. Try again later.", "info");
          return;
        }
        throw new Error(response.error ?? "Unable to fetch ideas");
      }

      setIdeas(response.data.ideas);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate ideas";
      setIdeasError(message);
      if (message !== "No posts detected. Scroll the feed and try again.") {
        showToast(message, "error");
      }
    } finally {
      setIdeasLoading(false);
    }
  }, [pageContext, styleProfile, showToast]);

  const generateReplies = useCallback(async () => {
    setRepliesLoading(true);
    setRepliesError(null);
    try {
      const tweet = extractTweetSnippet(document);
      if (!tweet) {
        showToast("Open a tweet to draft replies.", "info");
        throw new Error("Open a tweet to unlock ReplyCopilot.");
      }

      const response = await sendMessage<RepliesResponse>({
        type: "pulse:apiRequest",
        path: "ai/replies",
        body: {
          tweet_text: tweet,
          context_summary: null,
          style_profile: styleProfile,
        },
      });

      if (!response.ok) {
        if (response.error === "Throttled") {
          showToast("ReplyCopilot cooling down for a moment.", "info");
          return;
        }
        if (response.error === "rate_limited") {
          showToast("Hour limit reached. Try again later.", "info");
          return;
        }
        throw new Error(response.error ?? "Unable to fetch replies");
      }

      setReplies(response.data.replies);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate replies";
      setRepliesError(message);
      if (!message.startsWith("Open a tweet")) {
        showToast(message, "error");
      }
    } finally {
      setRepliesLoading(false);
    }
  }, [styleProfile, showToast]);

  const canGenerateIdeas = pageContext === "home" || pageContext === "mentions";
  const canGenerateReplies = pageContext === "tweet";

  const copyIdea = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Idea copied to clipboard.", "info");
  }, [showToast]);

  const ideaItems = useMemo(
    () =>
      ideas.flatMap((idea) =>
        idea.items.map((item) => ({
          topic: idea.topic,
          hook: item.hook,
          outline: item.mini_outline,
          virality: item.virality_score,
          trendNotes: idea.trend_notes,
        })),
      ),
    [ideas],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Card
        sx={{
          bgcolor: "rgba(15,20,25,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 3,
          boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
          transition: "transform 0.25s ease, box-shadow 0.25s ease",
          '&:hover': {
            transform: "translateY(-2px)",
            boxShadow: "0 16px 36px rgba(0,0,0,0.4)",
          },
        }}
      >
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 1 }}>
            <Typography variant="h6" fontWeight={600}>
              Pulse Kit
            </Typography>
            {(ideasLoading || repliesLoading) && <LoadingDot />}
          </Stack>

          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': { transition: "color 0.2s ease" },
              '& .MuiTabs-indicator': { transition: "all 0.3s ease" },
            }}
          >
            <Tab label="IdeaEngine" value="ideas" />
            <Tab label="ReplyCopilot" value="replies" />
          </Tabs>

          <Collapse in={showDebug} unmountOnExit>
            <Box
              sx={{
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.08)",
                bgcolor: "rgba(255,255,255,0.04)",
                p: 2,
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Selector diagnostics
              </Typography>
              <Stack spacing={1} sx={{ mb: 1 }}>
                {diagnostics.map((item) => (
                  <Stack key={item.label} direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      {item.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.matches}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Button size="small" variant="outlined" onClick={() => window.location.reload()}>
                Reload page
              </Button>
            </Box>
          </Collapse>

          {tab === "ideas" && (
            <Stack spacing={2} sx={{ transition: "opacity 0.2s ease" }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Turn today’s feed into high-signal hooks.
              </Typography>
              {!canGenerateIdeas && (
                <Alert severity="info">Visit X home or mentions to analyze posts.</Alert>
              )}
              <Button
                variant="contained"
                onClick={generateIdeas}
                disabled={ideasLoading || !canGenerateIdeas}
              >
                {ideasLoading ? "Analyzing..." : "Analyze this page"}
              </Button>
              {ideasError && <Alert severity="error">{ideasError}</Alert>}
              {ideaItems.length > 0 && (
                <Stack spacing={1.5}>
                  {ideaItems.map((idea, index) => (
                    <Box
                      key={`${idea.topic}-${index}`}
                      className="rounded-2xl border border-white/10 bg-black/40 p-3"
                      sx={{ transition: "transform 0.2s ease", '&:hover': { transform: "translateY(-1px)" } }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">
                          {idea.topic}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {idea.hook}
                        </Typography>
                        <ul className="list-disc pl-5 text-sm text-slate-300">
                          {idea.outline.map((line, idx) => (
                            <li key={idx}>{line}</li>
                          ))}
                        </ul>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            Virality score: {idea.virality}
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => copyIdea(`${idea.hook}\n${idea.outline.join("\n")}`)}
                            >
                              Copy
                            </Button>
                          </Stack>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          )}

          {tab === "replies" && (
            <Stack spacing={2} sx={{ transition: "opacity 0.2s ease" }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Drop an on-brand reply in seconds.
              </Typography>
              {!canGenerateReplies && (
                <Alert severity="info">Open a tweet to generate context-aware replies.</Alert>
              )}
              <Button
                variant="contained"
                onClick={generateReplies}
                disabled={repliesLoading || !canGenerateReplies}
              >
                {repliesLoading ? "Summarizing..." : "Draft replies"}
              </Button>
              {repliesError && <Alert severity="error">{repliesError}</Alert>}
              <Stack spacing={1.5}>
                {replies.map((reply, index) => (
                  <Box
                    key={index}
                    className="rounded-2xl border border-white/10 bg-black/40 p-3"
                    sx={{ transition: "transform 0.2s ease", '&:hover': { transform: "translateY(-1px)" } }}
                  >
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {reply}
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => insertText(reply)}>
                      Insert
                    </Button>
                  </Box>
                ))}
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {toast && (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        )}
      </Snackbar>
    </ThemeProvider>
  );
};

export default SidePanel;
