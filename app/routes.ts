import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/_protected.tsx", [index("routes/challenges.tsx")]),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
