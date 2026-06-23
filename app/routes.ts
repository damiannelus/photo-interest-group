import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("why", "routes/why.tsx"),
  layout("routes/_protected.tsx", [
    index("routes/challenges.tsx"),
    route("challenges/new", "routes/challenges.new.tsx"),
  ]),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
