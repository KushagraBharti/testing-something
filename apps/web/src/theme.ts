import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#1D9BF0",
      light: "#78C6FF",
    },
    background: {
      default: "#000000",
      paper: "#11161D",
    },
    text: {
      primary: "#E7ECF0",
      secondary: "#8B98A5",
    },
  },
  typography: {
    fontFamily: ["Inter", "Helvetica", "Arial", "sans-serif"].join(","),
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    body1: { lineHeight: 1.5 },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableRipple: true,
      },
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
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 16,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(255,255,255,0.08)",
          transition: "transform 0.25s ease, box-shadow 0.25s ease",
          '&:hover': {
            transform: "translateY(-2px)",
            boxShadow: "0 18px 36px rgba(0,0,0,0.35)",
          },
        },
      },
    },
  },
});

export default theme;
