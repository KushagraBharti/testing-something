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
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

export default theme;
