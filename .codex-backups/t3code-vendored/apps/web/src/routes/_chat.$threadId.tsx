import { createFileRoute, retainSearchParams } from "@tanstack/react-router";

import { type DiffRouteSearch, parseDiffRouteSearch } from "../diffRouteSearch";
import { ThreadRouteScreen } from "./-ThreadRouteScreen";

function ChatThreadRouteView() {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const search = Route.useSearch();

  return <ThreadRouteScreen threadIdParam={threadId} search={search} uiMode="full" />;
}

export const Route = createFileRoute("/_chat/$threadId")({
  validateSearch: (search) => parseDiffRouteSearch(search),
  search: {
    middlewares: [retainSearchParams<DiffRouteSearch>(["diff"])],
  },
  component: ChatThreadRouteView,
});
