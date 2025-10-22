import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import SettingsPage from "./pages/SettingsPage";
import { useSession } from "./hooks/useSession";

const NavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, clearSession } = useSession();

  const handleSignOut = () => {
    clearSession();
    navigate("/login");
  };

  const isSettings = location.pathname.startsWith("/settings");

  return (
    <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "rgba(255,255,255,0.08)" }}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" fontWeight={600} color="primary.light">
            Pulse Kit
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Control Center
          </Typography>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          {session.token ? (
            <>
              <Button
                component={Link}
                to="/settings"
                variant={isSettings ? "contained" : "text"}
                color="primary"
              >
                Settings
              </Button>
              <Button variant="text" color="inherit" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Button component={Link} to="/login" variant="outlined" color="inherit">
              Login
            </Button>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

const App = () => (
  <Box sx={{ minHeight: "100vh", backgroundColor: "brand.background", color: "white" }}>
    <NavBar />
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </Container>
  </Box>
);

export default App;
