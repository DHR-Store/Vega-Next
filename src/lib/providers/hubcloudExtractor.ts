import axios from 'axios';
import * as cheerio from 'cheerio';
import {Stream} from './types';
import {headers} from './headers';

const decode = function (value: string) {
  if (value === undefined) {
    return '';
  }
  return atob(value.toString());
};

export async function hubcloudExtracter(link: string, signal: AbortSignal) {
  try {
    console.log('hubcloudExtracter', link);
    const baseUrl = link.split('/').slice(0, 3).join('/');
    const streamLinks: Stream[] = [];
    const vLinkRes = await axios(`${link}`, {headers, signal});
    const vLinkText = vLinkRes.data;
    const $vLink = cheerio.load(vLinkText);
    const vLinkRedirect = vLinkText.match(/var\s+url\s*=\s*'([^']+)';/) || [];
    let vcloudLink =
      decode(vLinkRedirect[1]?.split('r=')?.[1]) ||
      vLinkRedirect[1] ||
      $vLink('.fa-file-download.fa-lg').parent().attr('href') ||
      link;
    console.log('vcloudLink', vcloudLink);
    if (vcloudLink?.startsWith('/')) {
      vcloudLink = `${baseUrl}${vcloudLink}`;
      console.log('New vcloudLink', vcloudLink);
    }
    const vcloudRes = await fetch(vcloudLink, {
      headers,
      signal,
      redirect: 'follow',
    });
    const $ = cheerio.load(await vcloudRes.text());
    // console.log('vcloudRes', $.text());

    // ADDED: Appended "a.btn" to catch all download buttons properly
    const linkClass = $('.btn-success.btn-lg.h6,.btn-danger,.btn-secondary, a.btn');
    
    // ADDED: Prevent processing the same link twice due to the broadened selector
    const processedLinks = new Set<string>();

    for (const element of linkClass) {
      const itm = $(element);
      let link = itm.attr('href') || '';

      // ADDED: Filter out Telegram links, empty links, VPN ads, or duplicates
      if (!link || processedLinks.has(link) || link.toLowerCase().includes('telegram') || link.includes('t.me') || link.includes('one.one.one.one') || link.includes('tinyurl.com')) {
          continue;
      }
      processedLinks.add(link);

      // ADDED: Decode base64 links passed through re.php
      if (link.includes('re.php?l=')) {
          try {
              const b64 = link.split('re.php?l=')[1].split('&')[0];
              link = decode(b64);
          } catch(e) {}
      }

      // ADDED: Extract server name directly from the button's text for fallback
      const btnText = itm.text().trim();
      const serverNameMatch = btnText.match(/\[(.*?)\]/);
      const fallbackServerName = serverNameMatch ? serverNameMatch[1] : (btnText.replace('Download', '').trim() || 'Download Server');

      switch (true) {
        case link?.includes('.dev') && !link?.includes('/?id='):
          streamLinks.push({server: 'Cf Worker', link: link, type: 'mkv'});
          break;

        case link?.includes('pixeld'):
          if (!link?.includes('api')) {
            const token = link.split('/').pop();
            const baseUrl = link.split('/').slice(0, -2).join('/');
            link = `${baseUrl}/api/file/${token}?download`;
          }
          streamLinks.push({server: 'Pixeldrain', link: link, type: 'mkv'});
          break;

        case link?.includes('hubcloud') || link?.includes('/?id='):
          try {
            const newLinkRes = await fetch(link, {
              method: 'HEAD',
              headers,
              signal,
              redirect: 'manual',
            });

            // Check if response is a redirect (301, 302, etc.)
            let newLink = link;
            if (newLinkRes.status >= 300 && newLinkRes.status < 400) {
              newLink = newLinkRes.headers.get('location') || link;
            } else if (newLinkRes.url && newLinkRes.url !== link) {
              // Fallback: check if URL changed (redirect was followed)
              newLink = newLinkRes.url;
            } else {
              newLink = newLinkRes.headers.get('location') || link;
            }
            if (newLink.includes('googleusercontent')) {
              newLink = newLink.split('?link=')[1];
            } else {
              const newLinkRes2 = await fetch(newLink, {
                method: 'HEAD',
                headers,
                signal,
                redirect: 'manual',
              });

              // Check if response is a redirect
              if (newLinkRes2.status >= 300 && newLinkRes2.status < 400) {
                newLink =
                  newLinkRes2.headers.get('location')?.split('?link=')[1] ||
                  newLink;
              } else if (newLinkRes2.url && newLinkRes2.url !== newLink) {
                // Fallback: URL changed due to redirect
                newLink = newLinkRes2.url.split('?link=')[1] || newLinkRes2.url;
              } else {
                newLink =
                  newLinkRes2.headers.get('location')?.split('?link=')[1] ||
                  newLink;
              }
            }

            streamLinks.push({
              server: 'hubcloud',
              link: newLink,
              type: 'mkv',
            });
          } catch (error) {
            console.log('hubcloudExtracter error in hubcloud link: ', error);
          }
          break;

        case link?.includes('cloudflarestorage'):
          streamLinks.push({server: 'CfStorage', link: link, type: 'mkv'});
          break;

        case link?.includes('fastdl') || link?.includes('fsl.'):
          streamLinks.push({server: 'FastDl', link: link, type: 'mkv'});
          break;

        case link.includes('hubcdn') && !link.includes('/?id='):
          streamLinks.push({
            server: 'HubCdn',
            link: link,
            type: 'mkv',
          });
          break;

        default:
          if (link?.includes('.mkv')) {
            const serverName =
              link
                .match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i)?.[1]
                ?.replace(/\./g, ' ') || 'Unknown';
            streamLinks.push({server: serverName, link: link, type: 'mkv'});
          } else if (link.startsWith('http')) {
            // ADDED: Catch-all for valid CDN links (like piececdn) that don't explicitly have '.mkv'
            streamLinks.push({server: fallbackServerName, link: link, type: 'mkv'});
          }
          break;
      }
    }

    console.log('streamLinks', streamLinks);
    return streamLinks;
  } catch (error) {
    console.log('hubcloudExtracter error: ', error);
    return [];
  }
}