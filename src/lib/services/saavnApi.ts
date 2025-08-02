/**
 * @fileoverview This file contains the API service for fetching music data from Jiosaavn.
 * It provides functions for searching, fetching song details, album details, and more.
 *
 * NOTE: The Jiosaavn API is unofficial and may change. The API endpoints used here
 * are based on common third-party implementations. You may need to update these
 * if the API endpoints change in the future.
 */

// Define the base URL for the Jiosaavn API
const BASE_URL = 'https://jiosaavn-api-privatecvc2.vercel.app';

/**
 * A generic function to make API calls to the Jiosaavn API.
 * @param endpoint The API endpoint to call (e.g., '/search/songs', '/song').
 * @param params An object of query parameters to append to the URL.
 * @returns A promise that resolves with the JSON data from the API.
 */
async function fetchSaavnData(endpoint: string, params: Record<string, any> = {}) {
  try {
    const queryString = new URLSearchParams(params).toString();
    const url = `${BASE_URL}${endpoint}?${queryString}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching data from Jiosaavn API at ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Searches for songs, albums, and artists based on a query.
 * @param query The search query string.
 * @returns A promise that resolves with search results.
 */
export const searchSaavn = async (query: string) => {
  return fetchSaavnData('/search', { query });
};

/**
 * Gets a list of trending songs and albums for the home page.
 * @returns A promise that resolves with home page data.
 */
export const getHomePageData = async () => {
  return fetchSaavnData('/modules');
};

/**
 * Gets the details of a specific song.
 * @param songId The unique ID of the song.
 * @returns A promise that resolves with song details.
 */
export const getSongDetails = async (songId: string) => {
  return fetchSaavnData('/song', { id: songId });
};

/**
 * Gets the details of a specific album.
 * @param albumId The unique ID of the album.
 * @returns A promise that resolves with album details and song list.
 */
export const getAlbumDetails = async (albumId: string) => {
  return fetchSaavnData('/album', { id: albumId });
};

/**
 * Gets the details of a specific playlist.
 * @param playlistId The unique ID of the playlist.
 * @returns A promise that resolves with playlist details and song list.
 */
export const getPlaylistDetails = async (playlistId: string) => {
  return fetchSaavnData('/playlist', { id: playlistId });
};

/**
 * Gets the details of an artist.
 * @param artistId The unique ID of the artist.
 * @returns A promise that resolves with artist details.
 */
export const getArtistDetails = async (artistId: string) => {
  return fetchSaavnData('/artist', { id: artistId });
};

/**
 * Gets the trending songs.
 * @returns A promise that resolves with a list of trending songs.
 */
export const getTrendingSongs = async () => {
  return fetchSaavnData('/modules?language=english');
};

/**
 * Gets the quick picks/suggestions for the home page.
 * @returns A promise that resolves with a list of quick picks.
 */
export const getQuickPicks = async () => {
  return fetchSaavnData('/modules?language=english'); // Re-using the modules endpoint for quick picks
};

/**
 * Gets search suggestions/hints as the user types.
 * @param query The search query string.
 * @returns A promise that resolves with search hints.
 */
export const getSearchHints = async (query: string) => {
  return fetchSaavnData('/search/suggestions', { query });
};
