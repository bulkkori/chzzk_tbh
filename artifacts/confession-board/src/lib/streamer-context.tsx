import { useParams } from "wouter";
import { useGetStreamer, type StreamerSummary } from "@workspace/api-client-react";

/**
 * Reads the `:channelId` route param and fetches that streamer.
 * Use inside any page mounted under `/s/:channelId/...`.
 */
export function useCurrentStreamer(): {
  channelId: string | undefined;
  streamer: StreamerSummary | undefined;
  isLoading: boolean;
  notFound: boolean;
} {
  const params = useParams<{ channelId?: string }>();
  const channelId = params.channelId;
  const query = useGetStreamer(channelId ?? "", {
    query: { enabled: !!channelId, retry: false },
  });
  const status = (query.error as { status?: number } | undefined)?.status;
  return {
    channelId,
    streamer: query.data,
    isLoading: query.isLoading,
    notFound: status === 404,
  };
}
