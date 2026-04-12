import { createRoot } from "react-dom/client";
import { StrictMode, useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";

const CONVEX_URL =
  import.meta.env.VITE_CONVEX_URL || "http://127.0.0.1:3210";

function Root() {
  const client = useMemo(() => new ConvexReactClient(CONVEX_URL), []);
  return (
    <StrictMode>
      <ConvexProvider client={client}>
        <App />
      </ConvexProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
