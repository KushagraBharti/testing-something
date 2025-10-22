import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { ThemeProvider, CssBaseline } from "@mui/material";
import {
  extractMessageSnippets,
  extractTimelineSnippets,
  extractTweetSnippet,
  inferPageContext,
  type IdeasResponse,
  type RepliesResponse,
  type StyleProfile,
} from "@pulse-kit/shared";
import theme from "../theme";
import { defaultStyleProfile } from "../../lib/defaultProfile";
import { insertIntoComposer } from "../../lib/insertion";
import { STORAGE_KEYS, type ExtensionMessage, type ExtensionResponse } from "../../lib/messages";

const defaultProfile: StyleProfile = {
  voice: "Analytical, optimistic operator",
  cadence: "Fast tempo with reflective beats",
  sentence_length: "Short bursts with occasional expansion",
  favorite_phrases: ["ship it", "zoom out", "builders"],
  banned_words: ["cringe", "synergy"],
};

type TabKey = "ideas" | "replies";

type PageContext = ReturnType<typeof inferPageContext>;

const sendMessage = async <T,>(message: ExtensionMessage) =>
  new Promise<ExtensionResponse<T>>((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response as ExtensionResponse<T>);
    });
  });

const SidePanel = () => {
  const [tab, setTab] = useState<TabKey>("ideas");
  const [pageContext, setPageContext] = useState<PageContext>(inferPageContext(window.location.href));
  const [styleProfile, setStyleProfile] = useState<StyleProfile>(defaultProfile);

  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<IdeasResponse["ideas"]>([]);

  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [replies, setReplies] = useState<string[]>([]);

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEYS.styleProfile], (value) => {
      const stored = value[STORAGE_KEYS.styleProfile] as StyleProfile | undefined;
      if (stored) {
        setStyleProfile({ ...defaultProfile, ...stored });
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

  const generateIdeas = useCallback(async () => {
    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const contextKey = pageContext === "mentions" ? "mentions" : "home";
      const snippets = extractTimelineSnippets(document, contextKey === "mentions" ? "mentions" : "home", 30);
      if (snippets.length === 0) {
        throw new Error("No posts detected. Scroll the feed and try again.");
      }

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
        throw new Error(response.error ?? "Unable to fetch ideas");
      }

      setIdeas(response.data.ideas);
    } catch (error) {
      setIdeasError(error instanceof Error ? error.message : "Failed to generate ideas");
    } finally {
      setIdeasLoading(false);
    }
  }, [pageContext, styleProfile]);

  const generateReplies = useCallback(async () => {
    setRepliesLoading(true);
    setRepliesError(null);
    try {
      const tweet = extractTweetSnippet(document);
      if (!tweet) {
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
        throw new Error(response.error ?? "Unable to fetch replies");
      }

      setReplies(response.data.replies);
    } catch (error) {
      setRepliesError(error instanceof Error ? error.message : "Failed to generate replies");
    } finally {
      setRepliesLoading(false);
    }
  }, [styleProfile]);

  const canGenerateIdeas = pageContext === "home" || pageContext === "mentions";
  const canGenerateReplies = pageContext === "tweet";

  const copyIdea = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth">
              <Tab label="IdeaEngine" value="ideas" />
              <Tab label="ReplyCopilot" value="replies" />
            </Tabs>
            {tab === "ideas" && (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Turn today’s feed into high-signal hooks.
                </Typography>
                {!canGenerateIdeas && (
                  <Alert severity="info">Visit X home or mentions to analyze posts.</Alert>
                )}
                <Button variant="contained" onClick={generateIdeas} disabled={ideasLoading || !canGenerateIdeas}>
                  {ideasLoading ? "Analyzing..." : "Analyze this page"}
                </Button>
                {ideasError && <Alert severity="error">{ideasError}</Alert>}
                {ideasLoading && <CircularProgress size={24} />}
                {ideaItems.length > 0 && (
                  <Stack spacing={1.5}>
                    {ideaItems.map((idea, index) => (
                      <Box key={`${idea.topic}-${index}`} className="rounded-2xl border border-white/10 bg-black/40 p-3">
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
                            <Button size="small" variant="outlined" onClick={() => copyIdea(`${idea.hook}\n${idea.outline.join("\n")}`)}>
                              Copy
                            </Button>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
            {tab === "replies" && (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Drop an on-brand reply in seconds.
                </Typography>
                {!canGenerateReplies && (
                  <Alert severity="info">Open a tweet to generate context-aware replies.</Alert>
                )}
                <Button variant="contained" onClick={generateReplies} disabled={repliesLoading || !canGenerateReplies}>
                  {repliesLoading ? "Summarizing..." : "Draft replies"}
                </Button>
                {repliesError && <Alert severity="error">{repliesError}</Alert>}
                <Stack spacing={1.5}>
                  {replies.map((reply, index) => (
                    <Box key={index} className="rounded-2xl border border-white/10 bg-black/40 p-3">
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {reply}
                      </Typography>
                      <Button size="small" variant="outlined" onClick={() => insertIntoComposer(reply)}>
                        Insert
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </ThemeProvider>
  );
};

export default SidePanel;
