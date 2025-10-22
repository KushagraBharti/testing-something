import { Box, Button, CssBaseline, Stack, ThemeProvider, Typography } from "@mui/material";
import theme from "../content/theme";

const openSettings = () => {
  chrome.tabs.create({ url: "https://localhost:5173/settings" });
};

const PopupApp = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Box sx={{ width: 320, p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6" fontWeight={600}>
          Pulse Kit
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Trigger IdeaEngine from the feed or drop replies on any tweet. Update style profile or keys from Settings.
        </Typography>
        <Button variant="contained" onClick={openSettings}>
          Open Settings
        </Button>
      </Stack>
    </Box>
  </ThemeProvider>
);

export default PopupApp;
