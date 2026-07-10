import axios from 'axios';
import { getBaseUrl } from './getBaseUrl';
import { headers } from './headers';
import * as cheerio from 'cheerio';
import { hubcloudExtracter } from './hubcloudExtractor';
import { gofileExtracter } from './gofileExtracter';
import { superVideoExtractor } from './superVideoExtractor';
import { gdFlixExtracter } from './gdflixExtractor';
import { ProviderContext } from './types';
import * as Crypto from 'expo-crypto';
import { useCfStore } from '../zustand/cfStore';

// --- CONCURRENCY QUEUE ---
let isSolvingCaptcha = false;
let failedQueue: Array<{ resolve: (userAgent: string) => void, reject: (err: any) => void }> = [];

const processFailedQueue = (error: any, userAgent: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(userAgent!);
    }
  });
  failedQueue = [];
};

// --- REQUEST INTERCEPTOR ---
axios.interceptors.request.use((config) => {
  const { savedUserAgent } = useCfStore.getState();
  
  // Use genuine mobile UA if solved, else fallback
  config.headers['User-Agent'] = savedUserAgent || headers['User-Agent'];
  
  // Notice we are NOT setting 'Cookie' manually here anymore.
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- RESPONSE INTERCEPTOR ---
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isCloudflare =
      (error.response?.status === 403 || error.response?.status === 503) &&
      (error.response?.headers?.['server']?.toLowerCase().includes('cloudflare') ||
       error.response?.data?.includes('Just a moment') ||
       error.response?.data?.includes('cf-browser-verification'));

    if (isCloudflare && !originalRequest._retry) {
      originalRequest._retry = true;

      // If a solver is already open, queue this request instead of opening another one
      if (isSolvingCaptcha) {
        console.log(`⏳ [Queue] Request waiting for solver: ${originalRequest.url}`);
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(userAgent => {
          originalRequest.headers['User-Agent'] = userAgent;
          return axios(originalRequest);
        })
        .catch(err => Promise.reject(err));
      }

      console.log(`⚠️ [Cloudflare Blocked] Triggering solver for: ${originalRequest.url}`);
      isSolvingCaptcha = true;

      try {
        const { userAgent } = await useCfStore.getState().triggerCfSolver(originalRequest.url);
        
        isSolvingCaptcha = false;
        processFailedQueue(null, userAgent);

        originalRequest.headers['User-Agent'] = userAgent;
        console.log(`🔄 [Axios Retry] Resuming request for: ${originalRequest.url}`);
        return axios(originalRequest);
      } catch (cfError) {
        isSolvingCaptcha = false;
        processFailedQueue(cfError, null);
        return Promise.reject(cfError);
      }
    }

    return Promise.reject(error);
  }
);

const extractors = {
  hubcloudExtracter,
  gofileExtracter,
  superVideoExtractor,
  gdFlixExtracter,
};

export const providerContext: ProviderContext = {
  axios,
  getBaseUrl,
  commonHeaders: headers,
  Crypto,
  cheerio,
  extractors,
};