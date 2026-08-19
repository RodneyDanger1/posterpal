import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({ component: Login });

/** Personal desk — no sign-in. Anyone landing here goes straight to Pages. */
function Login() {
  return <Navigate to="/" />;
}
