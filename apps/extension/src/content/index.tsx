import React from "react";
import { createRoot } from "react-dom/client";
import SidePanel from "./components/SidePanel";
import "../styles/tailwind.css";

const ROOT_ID = "pulse-kit-side-panel";

const mount = () => {
  let host = document.getElementById(ROOT_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = ROOT_ID;
    host.className = "pulse-kit-panel-host";
    document.body.appendChild(host);
  }

  host.classList.add(
    "fixed",
    "top-28",
    "right-6",
    "z-[2147483647]",
    "w-[360px]",
    "text-white",
    "font-sans",
  );

  createRoot(host).render(
    <React.StrictMode>
      <SidePanel />
    </React.StrictMode>,
  );
};

mount();
