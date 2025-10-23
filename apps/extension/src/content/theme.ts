import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#1D9BF0",
      light: "#78C6FF",
    },
    background: {
      default: "#0f1419",
      paper: "#11161d",
    },
    text: {
      primary: "#E7ECF0",
      secondary: "#8B98A5",
    },
  },
  typography: {
    fontFamily: ["Inter", "Helvetica", "Arial", "sans-serif"].join(","),
    h6: {
      fontSize: "1.1rem",
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 600,
    },
    body2: {
      lineHeight: 1.45,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(15,20,25,0.95)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: "none",
          transition: "background-color 0.2s ease, transform 0.2s ease",
          '&:hover': {
            transform: "translateY(-1px)",
          },
        },
      },
    },
  },
});

export default theme;
