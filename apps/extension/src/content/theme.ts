import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#1D9BF0",
    },
    background: {
      default: "#0f1419",
      paper: "#15202b",
    },
    text: {
      primary: "#E7ECF0",
      secondary: "#8B98A5",
    },
  },
  typography: {
    fontFamily: ["Inter", "Helvetica", "Arial", "sans-serif"].join(","),
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(15,20,25,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
        },
      },
    },
  },
});

export default theme;
