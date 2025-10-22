import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../LoginPage";
import { SessionProvider } from "../../hooks/useSession";

const renderPage = () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
};

describe("LoginPage", () => {
  it("renders login actions", () => {
    renderPage();
    expect(screen.getByText(/IdeaEngine/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Login with X/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Demo Session/i })).toBeInTheDocument();
  });
});
