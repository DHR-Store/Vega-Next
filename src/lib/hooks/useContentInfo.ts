import { useQuery } from '@tanstack/react-query';
import { providerManager } from '../services/ProviderManager';
import axios from 'axios';

// A single source of truth for the API endpoint to avoid duplication
const CINEMETA_API_URL = 'https://v3-cinemeta.strem.io/meta';

/**
 * Hook for fetching basic content information from a specific provider.
 * This is the first step in our data fetching pipeline.
 *
 * @param {string} link - The unique link for the content.
 * @param {string} providerValue - The provider's unique identifier.
 */
export const useContentInfo = (link: string, providerValue: string) => {
  return useQuery({
    queryKey: ['contentInfo', link, providerValue],
    queryFn: async () => {
      console.log('Fetching content info for:', link);
      
      const data = await providerManager.getMetaData({
        link,
        provider: providerValue,
      });

      // Simple validation to ensure the provider returned useful data.
      if (!data || (!data.title && !data.synopsis && !data.image)) {
        throw new Error('Error: No data returned from provider');
      }

      return data;
    },
    // The `enabled` flag is correctly used to prevent the query from running
    // until `link` and `providerValue` are present.
    enabled: !!link && !!providerValue,
    staleTime: 10 * 60 * 1000, // Data is considered fresh for 10 minutes
    gcTime: 60 * 60 * 1000, // Cached data will be garbage collected after 1 hour
    retry: 2,
  });
};

/**
 * Hook for fetching enhanced metadata from the Stremio Cinemeta API.
 * This is a dependent query that relies on the `imdbId` and `type` from the first hook.
 *
 * @param {string} imdbId - The IMDb ID of the content.
 * @param {string} type - The type of content (e.g., "movie", "series").
 */
export const useEnhancedMetadata = (imdbId: string, type: string) => {
  return useQuery({
    queryKey: ['enhancedMeta', imdbId, type],
    queryFn: async () => {
      console.log('Fetching enhanced metadata for:', imdbId);
      
      const response = await axios.get(
        `${CINEMETA_API_URL}/${type}/${imdbId}.json`,
        {timeout: 10000},
      );
      
      return response.data?.meta;
    },
    // The `enabled` flag is crucial here. It ensures this query only runs when
    // `imdbId` and `type` are available from the previous query.
    enabled: !!imdbId && !!type,
    staleTime: 30 * 60 * 1000, // Metadata changes rarely, so cache for longer
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1, // Don't retry too much for an external API
  });
};

/**
 * A combined hook that orchestrates the fetching of both content info and enhanced metadata.
 * It provides a single, easy-to-use interface for components.
 *
 * @param {string} link - The unique link for the content.
 * @param {string} providerValue - The provider's unique identifier.
 */
export const useContentDetails = (link: string, providerValue: string) => {
  // First, get the basic content info
  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
    refetch: refetchInfo,
  } = useContentInfo(link, providerValue);

  // Then, get enhanced metadata using the data from the first query
  const {
    data: meta,
    isLoading: metaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useEnhancedMetadata(info?.imdbId || '', info?.type || '');

  return {
    info,
    meta,
    // The combined loading state is true if either query is loading
    isLoading: infoLoading || metaLoading,
    // The combined error state is true if either query has an error
    error: infoError || metaError,
    // A combined refetch function that refreshes both queries
    refetch: async () => {
      await Promise.all([refetchInfo(), refetchMeta()]);
    },
  };
};