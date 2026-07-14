/**
 * Returns the JavaScript that intercepts browser navigation APIs, forms, timers, and AJAX.
 * This runs BEFORE any content is loaded on the page.
 */
export function getInjectedBeforeContentLoadedScript(): string {
  return `
    (function() {
      if (window.__SCRAPER_API_INTERCEPTED__) return;
      window.__SCRAPER_API_INTERCEPTED__ = true;

      console.log("[SCRAPER] Injecting safe browser API wrappers...");

      // Active AJAX tracking for network-idle detection
      window.__activeAjaxCount__ = 0;
      
      const originalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function() {
          window.__activeAjaxCount__++;
          return originalOpen.apply(xhr, arguments);
        };
        
        xhr.addEventListener('readystatechange', function() {
          if (xhr.readyState === 4) {
            window.__activeAjaxCount__ = Math.max(0, window.__activeAjaxCount__ - 1);
          }
        });
        
        return xhr;
      };

      const originalFetch = window.fetch;
      window.fetch = function() {
        window.__activeAjaxCount__++;
        return originalFetch.apply(this, arguments)
          .then(res => {
            window.__activeAjaxCount__ = Math.max(0, window.__activeAjaxCount__ - 1);
            return res;
          })
          .catch(err => {
            window.__activeAjaxCount__ = Math.max(0, window.__activeAjaxCount__ - 1);
            throw err;
          });
      };

      // Redirect Timers Tracking
      window.__pendingRedirectTimers__ = 0;
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function(handler, timeout) {
        let isRedirectTimer = false;
        try {
          const handlerStr = typeof handler === 'string' 
            ? handler 
            : (typeof handler === 'function' ? handler.toString() : '');
          
          if (/location|redirect|submit|href|replace|assign|reload/i.test(handlerStr)) {
            isRedirectTimer = true;
            window.__pendingRedirectTimers__++;
          }
        } catch (e) {}

        const wrappedHandler = function() {
          if (isRedirectTimer) {
            window.__pendingRedirectTimers__ = Math.max(0, window.__pendingRedirectTimers__ - 1);
          }
          if (typeof handler === 'string') {
            return eval(handler);
          }
          return handler.apply(this, arguments);
        };

        return originalSetTimeout(wrappedHandler, timeout);
      };

      // API Overrides wrapped safely
      const originalOpen = window.open;
      window.open = function(url, target, features) {
        console.log("[SCRAPER] Intercepted window.open: " + url);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'REDIRECT_ATTEMPT',
          url: url || '',
          method: 'window.open'
        }));
        if (url) {
          window.location.href = url;
        }
        return null;
      };

      const originalAssign = window.location.assign;
      window.location.assign = function(url) {
        console.log("[SCRAPER] Intercepted location.assign: " + url);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'REDIRECT_ATTEMPT',
          url: url || '',
          method: 'location.assign'
        }));
        return originalAssign.apply(this, arguments);
      };

      const originalReplace = window.location.replace;
      window.location.replace = function(url) {
        console.log("[SCRAPER] Intercepted location.replace: " + url);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'REDIRECT_ATTEMPT',
          url: url || '',
          method: 'location.replace'
        }));
        return originalReplace.apply(this, arguments);
      };

      // History API Overrides
      const originalPushState = window.history.pushState;
      window.history.pushState = function(state, title, url) {
        console.log("[SCRAPER] Intercepted pushState: " + url);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'HISTORY_CHANGE',
          url: url || '',
          method: 'pushState'
        }));
        return originalPushState.apply(this, arguments);
      };

      const originalReplaceState = window.history.replaceState;
      window.history.replaceState = function(state, title, url) {
        console.log("[SCRAPER] Intercepted replaceState: " + url);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'HISTORY_CHANGE',
          url: url || '',
          method: 'replaceState'
        }));
        return originalReplaceState.apply(this, arguments);
      };

      // Form submission wrapper
      const originalSubmit = HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit = function() {
        console.log("[SCRAPER] Intercepted form.submit target: " + this.getAttribute('target'));
        this.removeAttribute('target'); // Stay in WebView
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FORM_SUBMIT_ATTEMPT',
          action: this.action || '',
          method: 'form.submit'
        }));
        return originalSubmit.apply(this, arguments);
      };

      // Request-Response Handshake logic on document load
      function checkHandshake() {
        console.log("[SCRAPER] Sending handshake request...");
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'HANDSHAKE_REQUEST',
          url: window.location.href
        }));
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkHandshake);
      } else {
        checkHandshake();
      }
    })();
    true;
  `;
}

/**
 * Returns the main execution engine script that is run once the React Native side
 * receives the handshake and injects the session state.
 */
export function getEngineExecutionScript(
  sessionRequestJson: string,
  sessionStateJson: string,
): string {
  return `
    (function() {
      // Define active session params
      const sessionRequest = ${sessionRequestJson};
      const sessionState = ${sessionStateJson};
      
      console.log("[SCRAPER] Active Session Initialized! Target Type: " + sessionRequest.targetType + ", Hop Count: " + sessionState.redirectCount);

      // IPC Helper functions
      function sendLog(message, logType = 'info') {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'LOG',
          message: message,
          logType: logType
        }));
      }

      function sendStateUpdate(state, confidence = 1.0, details = '') {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'STATE_TRANSITION',
          state: state,
          confidence: confidence,
          details: details,
          url: window.location.href,
          title: document.title
        }));
      }

      function sendSuccess(html, url, mirrors = []) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SUCCESS',
          html: html,
          url: url,
          mirrors: mirrors
        }));
      }

      function sendError(message) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ERROR',
          message: message
        }));
      }

      // Check current page rules & parameters
      const urlLower = window.location.href.toLowerCase();
      const titleLower = document.title.toLowerCase();
      const bodyTextLower = (document.body ? document.body.innerText : '').toLowerCase();

      // Extensible Strategy Layer Definitions
      const strategies = [
        {
          name: 'HDHub',
          matches: (url) => url.includes('hdhub') || url.includes('gamerxyt'),
          classify: (doc) => {
            const txt = doc.body ? doc.body.innerText.toLowerCase() : '';
            if (txt.includes('how to download') || txt.includes('hubcloud') || txt.includes('instant download')) {
              return 'MEDIATOR';
            }
            return null;
          },
          findActions: (doc) => {
            // Target specific HDHub button structures
            const candidates = [];
            doc.querySelectorAll('.download-btn, a[href*="gamerxyt"]').forEach(el => {
              candidates.push({ el: el, score: 95, label: 'HDHub Custom Link' });
            });
            return candidates;
          },
          extractMirrors: (doc) => null
        },
        {
          name: 'HubCloud',
          matches: (url) => url.includes('hubcloud') || url.includes('hubcdn') || url.includes('hubdrive'),
          classify: (doc) => {
            const h1s = Array.from(doc.querySelectorAll('h1')).map(h => h.textContent.toLowerCase());
            if (h1s.some(h => h.includes('hubcloud') || h.includes('download')) || doc.title.includes('HubCloud')) {
              if (doc.querySelector('a[href*="/download.php"], a[href*="pixeldrain"], a[href*="mega.nz"]')) {
                return 'MIRROR_PAGE';
              }
              return 'MEDIATOR';
            }
            return null;
          },
          findActions: (doc) => [],
          extractMirrors: (doc) => null
        },
        {
          name: 'PixelDrain',
          matches: (url) => url.includes('pixeldrain.com') || url.includes('pixeldrain.dev'),
          classify: (doc) => {
            if (urlLower.includes('/u/')) {
              return 'DIRECT_FILE_HOST';
            }
            return null;
          },
          findActions: (doc) => [],
          extractMirrors: (doc) => null
        }
      ];

      // Identify active strategy
      let activeStrategy = null;
      for (let s of strategies) {
        if (s.matches(window.location.href)) {
          activeStrategy = s;
          break;
        }
      }
      if (activeStrategy) {
        sendLog("[SCRAPER] Loaded portal strategy: " + activeStrategy.name, 'success');
      }

      // Ad Overlay Heuristic Bypass
      function removeAdOverlays() {
        if (!document.body) return;
        const divs = document.querySelectorAll('div, iframe, section');
        let removedCount = 0;
        
        divs.forEach(el => {
          try {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const zIndex = parseInt(style.zIndex) || 0;
            
            const isFullScreen = rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.9;
            const isFloating = style.position === 'fixed' || style.position === 'absolute';
            
            if (isFullScreen && isFloating) {
              const isTransparent = parseFloat(style.opacity) < 0.15 || style.backgroundColor === 'transparent' || style.backgroundColor.includes('rgba(0,0,0,0)');
              const hasAdKeywords = /ad-|popup|banner|sponsor|overlay|overlay-content/i.test(el.className || '' + el.id || '');
              const hasLegitKeywords = /cookie|consent|privacy|captcha|cloudflare|loading|wait|verify|human/i.test(el.innerText || '');
              
              if ((zIndex > 9000 && isTransparent && !hasLegitKeywords) || (hasAdKeywords && !hasLegitKeywords)) {
                el.style.display = 'none';
                el.remove();
                removedCount++;
              }
            }
          } catch(e) {}
        });
        if (removedCount > 0) {
          sendLog("[SCRAPER] Heuristics dismissed " + removedCount + " transparent ad overlay(s).");
        }
      }

      // Traversal logic for open Shadow DOM and same-origin frames
      function scanElementTree(root, tagNames, onFound) {
        function recurse(node) {
          if (!node) return;

          if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            
            // Match target tags
            if (tagNames.includes(tagName) || tagNames.includes('*')) {
              onFound(node);
            }

            // Recurse into open Shadow DOM
            if (node.shadowRoot) {
              recurse(node.shadowRoot);
            }

            // Recurse into same-origin iframes
            if (tagName === 'iframe') {
              try {
                if (node.contentDocument) {
                  recurse(node.contentDocument.body || node.contentDocument.documentElement);
                }
              } catch (e) {
                // Cross-origin iframe skipped safely
              }
            }
          }

          // Traverse standard DOM children
          for (let child of node.childNodes) {
            recurse(child);
          }
        }
        recurse(root);
      }

      // Button / Link Scanning Click Engine
      function findActionableButton() {
        const candidates = [];
        
        // Priority list
        const priorities = [
          { score: 100, regex: /^(continue|proceed to download|proceed)$/i },
          { score: 90, regex: /^(verify captcha|verify|i am human|verify you are human|confirm|verify me)$/i },
          { score: 80, regex: /^(next|next page)$/i },
          { score: 70, regex: /^(get link|getlink)$/i },
          { score: 65, regex: /^(download|download file|download now)$/i },
          { score: 50, regex: /^(watch offline|stream|play)$/i },
          { score: 40, regex: /^(server|mirror|buzz|fsl)$/i }
        ];

        // Search tags
        scanElementTree(document.body, ['a', 'button', 'input', 'div', 'span'], (el) => {
          try {
            // Check visibility
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            if (el.disabled || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true') return;

            const text = (el.textContent || el.value || '').trim().replace(/\\s+/g, ' ');
            const role = el.getAttribute('role') || '';
            const onclick = el.getAttribute('onclick') || '';
            const hasCursorPointer = style.cursor === 'pointer';
            const isClickableTag = ['a', 'button', 'input'].includes(el.tagName.toLowerCase());

            if (!text && !role && !onclick && !isClickableTag) return;

            // Clean href check for ad sites
            if (el.tagName.toLowerCase() === 'a') {
              const href = el.getAttribute('href') || '';
              if (href.startsWith('javascript:void(0)') || href === '#' || href === '') {
                // simple placeholder links
              } else if (/ad-|popads|propeller|clicktrack|promo/i.test(href)) {
                return; // skip ad links
              }
            }

            // Uniquely label candidate to prevent clicking loops
            const uniqueLabel = [el.tagName.toLowerCase(), text.substring(0, 20), Math.round(rect.top), Math.round(rect.left)].join('_');
            if (sessionState.clickedSelectors.includes(uniqueLabel)) {
              return; // Already clicked!
            }

            // Match text priority
            for (let priority of priorities) {
              if (priority.regex.test(text) || (role && priority.regex.test(role))) {
                candidates.push({
                  el: el,
                  score: priority.score,
                  text: text,
                  label: uniqueLabel
                });
                return;
              }
            }

            // Fallback for simple elements with onclick or cursor:pointer containing generic words
            if (onclick || hasCursorPointer || isClickableTag) {
              if (/continue|proceed|verify|next|link|download|server|mirror/i.test(text || onclick)) {
                candidates.push({
                  el: el,
                  score: 20,
                  text: text,
                  label: uniqueLabel
                });
              }
            }
          } catch (e) {}
        });

        // Add any strategy custom candidates
        if (activeStrategy && activeStrategy.findActions) {
          try {
            const stratCandidates = activeStrategy.findActions(document);
            stratCandidates.forEach(c => {
              const rect = c.el.getBoundingClientRect();
              const uniqueLabel = [c.el.tagName.toLowerCase(), c.label, Math.round(rect.top), Math.round(rect.left)].join('_');
              if (!sessionState.clickedSelectors.includes(uniqueLabel)) {
                candidates.push({
                  el: c.el,
                  score: c.score,
                  text: c.label,
                  label: uniqueLabel
                });
              }
            });
          } catch(e) {}
        }

        if (candidates.length === 0) return null;

        // Sort candidates
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0];
      }

      // Stability Detection Engine
      function waitForStability(onStable) {
        let lastMutationTime = Date.now();
        let lastUrl = window.location.href;
        let lastUrlTime = Date.now();
        
        let mutationObserver = null;
        let stabilityTimer = null;
        const maxWaitStart = Date.now();
        const MAX_STABILITY_WAIT = 5000; // Hard max 5 seconds

        function isStable() {
          const now = Date.now();
          const documentComplete = document.readyState === 'complete';
          const networkIdle = (window.__activeAjaxCount__ || 0) === 0;
          const mutationsSilent = (now - lastMutationTime) >= 500;
          const urlStable = (now - lastUrlTime) >= 500;
          const noTimersPending = (window.__pendingRedirectTimers__ || 0) === 0;

          if (documentComplete && networkIdle && mutationsSilent && urlStable && noTimersPending) {
            return true;
          }
          
          // Force stable if we exceeded hard wait limit
          if ((now - maxWaitStart) >= MAX_STABILITY_WAIT) {
            sendLog("[SCRAPER] Stability timeout reached. Forcing stability...", 'warn');
            return true;
          }

          return false;
        }

        function check() {
          if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            lastUrlTime = Date.now();
          }

          if (isStable()) {
            if (mutationObserver) mutationObserver.disconnect();
            clearInterval(stabilityTimer);
            onStable();
          }
        }

        // Setup MutationObserver
        try {
          mutationObserver = new MutationObserver(() => {
            lastMutationTime = Date.now();
          });
          mutationObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
        } catch (e) {
          sendLog("[SCRAPER] Failed to bind MutationObserver: " + e.message, 'warn');
        }

        stabilityTimer = setInterval(check, 250);
      }

      // Page Classification Engine
      function classifyPage() {
        let confidence = 0.5;
        let type = 'UNKNOWN';

        // 1. Cloudflare Check
        if (titleLower.includes('cloudflare') || titleLower.includes('just a moment') || document.querySelector('#cf-wrapper, .cf-challenge, #challenge-form')) {
          return { type: 'CLOUDFLARE', confidence: 0.95 };
        }

        // 2. Mirror Page check based on targetType
        let hasDirectFile = false;
        
        // Helper to check direct file url
        function isDirectFileUrl(url) {
          if (!url) return false;
          const lower = url.toLowerCase();
          if (
            lower.includes('cloudflarestorage.com') ||
            lower.includes('backblazeb2.com') ||
            lower.includes('storage.googleapis.com') ||
            lower.includes('s3.amazonaws.com') ||
            lower.includes('pixeldrain.com/api/file/') ||
            lower.includes('drive.google.com/uc') ||
            lower.includes('/download.php') ||
            (lower.includes('token=') && lower.includes('.zip'))
          ) {
            return true;
          }
          if (
            /filename.*?=.*?\\.(mkv|mp4|avi|zip|rar|tar|gz|mov|wmv|3gp|7z|dmg|iso|mp3|m4a|epub|pdf)/i.test(url) ||
            /content-disposition.*?filename/i.test(url) ||
            (lower.includes('filename') && (lower.includes('.zip') || lower.includes('.mkv') || lower.includes('.mp4')))
          ) {
            return true;
          }
          return /\\.(mkv|mp4|avi|zip|rar|tar|gz|mov|wmv|7z|dmg|iso|mp3|m4a|epub|pdf)(\\?|#|$)/i.test(lower);
        }

        // Search for direct download links in DOM
        let extractedLinks = [];
        scanElementTree(document.body, ['a'], (el) => {
          const href = el.getAttribute('href') || '';
          const text = (el.textContent || '').trim();
          
          if (!href || href === '#' || href.startsWith('javascript:')) return;
          
          const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.href).toString();
          
          if (sessionRequest.targetType === 'mirrors') {
            const isPromo = fullUrl.includes('t.me/') || fullUrl.includes('telegram.me') || fullUrl.includes('telegram.org') || /tutorial|how to/i.test(text);
            const isMirror = (
              fullUrl.includes('hubcloud') || 
              fullUrl.includes('drive.google.com') || 
              fullUrl.includes('mega.nz') || 
              fullUrl.includes('pixeldrain.com') ||
              /download|server|gdrive|direct|hubcloud|mega|pixeldrain|drive|gdtot/i.test(text)
            ) && !isPromo;
            if (isMirror && !extractedLinks.some(l => l.url === fullUrl)) {
              extractedLinks.push({ label: text || 'Download Mirror', url: fullUrl });
            }
          } else if (sessionRequest.targetType === 'direct-links') {
            const isPromo = fullUrl.includes('t.me/') || 
                            fullUrl.includes('telegram.me') || 
                            fullUrl.includes('telegram.org') || 
                            fullUrl.includes('telegram.dog') || 
                            /tutorial|how to/i.test(text);
            const isDirect = (
              /download/i.test(text) || 
              /direct/i.test(text) || 
              /fsl/i.test(text) || 
              /pixel/i.test(text) || 
              /server/i.test(text) || 
              /buzz/i.test(text) ||
              fullUrl.includes('/download.php') ||
              isDirectFileUrl(fullUrl)
            ) && !isPromo;
            if (isDirect && !extractedLinks.some(l => l.url === fullUrl)) {
              extractedLinks.push({ label: text, url: fullUrl });
            }
          } else if (sessionRequest.targetType === 'direct-file') {
            const isDirectFile = isDirectFileUrl(fullUrl) || /direct download|download file|download now|click here to download/i.test(text);
            if (isDirectFile) {
              hasDirectFile = true;
              extractedLinks.push({ label: text, url: fullUrl });
            }
          }
        });

        // If we found mirrors/links, classify!
        if (sessionRequest.targetType === 'mirrors' && extractedLinks.length > 0) {
          return { type: 'MIRROR_PAGE', confidence: 0.9, details: 'Found ' + extractedLinks.length + ' mirrors' };
        }
        if (sessionRequest.targetType === 'direct-links' && extractedLinks.length > 0) {
          return { type: 'MIRROR_PAGE', confidence: 0.9, details: 'Found ' + extractedLinks.length + ' direct links' };
        }
        if (sessionRequest.targetType === 'direct-file' && (hasDirectFile || isDirectFileUrl(window.location.href))) {
          return { type: 'DIRECT_FILE_HOST', confidence: 0.95, details: 'Direct file URL detected' };
        }

        // 3. Strategy classification overrides
        if (activeStrategy) {
          try {
            const stratType = activeStrategy.classify(document);
            if (stratType) {
              return { type: stratType, confidence: 0.9, details: 'Strategy override' };
            }
          } catch(e) {}
        }

        // 4. Verification Check
        if (document.querySelector('.g-recaptcha, .h-captcha, .cf-turnstile, iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"]') ||
            /verify you are human|i am human|confirm you are human|click here to verify/i.test(bodyTextLower)) {
          return { type: 'VERIFICATION', confidence: 0.85 };
        }

        // 5. Countdown Check
        const hasWaitKeywords = /wait\\s*\\d+|please wait|seconds|sec|timer/i.test(bodyTextLower);
        const disabledButtons = document.querySelectorAll('button:disabled, a.disabled, input:disabled');
        const hasDisabledNumbered = Array.from(disabledButtons).some(btn => /\\d+/.test(btn.textContent || btn.value || ''));
        if (hasDisabledNumbered || (hasWaitKeywords && /\\b\\d+\\s*(?:s|sec|second|seconds)\\b/i.test(bodyTextLower))) {
          return { type: 'COUNTDOWN', confidence: 0.85 };
        }

        // 6. JavaScript Redirect Check
        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        if (metaRefresh || window.__pendingRedirectTimers__ > 0) {
          return { type: 'REDIRECT', confidence: 0.8 };
        }

        // 7. Server Selection Check
        if (/select server|server list|choose download mirror/i.test(bodyTextLower) || document.querySelector('.server-selection, .servers')) {
          return { type: 'SERVER_SELECTION', confidence: 0.75 };
        }

        // 8. Mediator Check
        const actionButtonText = /continue|proceed|verify|next|get link|download|watch offline|server|mirror/i;
        const hasActionButtons = Array.from(document.querySelectorAll('button, a, input')).some(el => {
          const text = el.textContent || el.value || '';
          return actionButtonText.test(text);
        });
        if (hasActionButtons) {
          return { type: 'MEDIATOR', confidence: 0.7 };
        }

        return { type: 'UNKNOWN', confidence: 0.5 };
      }

      // STATE MACHINE RUNNER
      function executeStateMachine() {
        sendStateUpdate('INIT');
        
        waitForStability(() => {
          sendStateUpdate('WAIT_FOR_STABLE');
          
          removeAdOverlays();
          
          const classification = classifyPage();
          sendStateUpdate('CLASSIFY_PAGE', classification.confidence, classification.type + ': ' + (classification.details || ''));

          // Transition Handlers
          switch (classification.type) {
            case 'CLOUDFLARE':
              sendStateUpdate('HANDLE_CLOUDFLARE');
              sendLog("[SCRAPER] Cloudflare challenge page detected. Waiting up to 8s for solve...", 'warn');
              setTimeout(() => {
                // Reload state machine to re-evaluate stability after wait
                executeStateMachine();
              }, 8000);
              break;

            case 'VERIFICATION':
              sendStateUpdate('HANDLE_VERIFICATION');
              const verifyBtn = findActionableButton();
              if (verifyBtn && verifyBtn.score >= 80) {
                sendLog("[SCRAPER] Clicking verification action: " + verifyBtn.text);
                sessionState.clickedSelectors.push(verifyBtn.label);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'CLICK_ACTION',
                  selector: verifyBtn.label,
                  text: verifyBtn.text
                }));
                verifyBtn.el.click();
                // Re-evaluate page state after 4 seconds in case of inline state change / no navigation
                setTimeout(executeStateMachine, 4000);
              } else {
                sendLog("[SCRAPER] Verification page detected, but no click candidate found. Waiting 3s...", 'warn');
                setTimeout(executeStateMachine, 3000);
              }
              break;

            case 'COUNTDOWN':
              sendStateUpdate('HANDLE_COUNTDOWN');
              sendLog("[SCRAPER] Countdown active. Monitoring DOM for enable trigger...");
              // We just re-execute the stability checks which will await DOM mutations to complete
              setTimeout(executeStateMachine, 1500);
              break;

            case 'REDIRECT':
              sendStateUpdate('HANDLE_REDIRECT');
              sendLog("[SCRAPER] Redirect pending. Awaiting browser trigger...");
              setTimeout(executeStateMachine, 1500);
              break;

            case 'SERVER_SELECTION':
              sendStateUpdate('HANDLE_SERVER_SELECTION');
              const serverBtn = findActionableButton();
              if (serverBtn) {
                sendLog("[SCRAPER] Selecting server element: " + serverBtn.text);
                sessionState.clickedSelectors.push(serverBtn.label);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'CLICK_ACTION',
                  selector: serverBtn.label,
                  text: serverBtn.text
                }));
                serverBtn.el.click();
                // Re-evaluate page state after 4 seconds in case of inline state change / no navigation
                setTimeout(executeStateMachine, 4000);
              } else {
                sendLog("[SCRAPER] Server selection detected, but no candidates found.", 'warn');
                setTimeout(executeStateMachine, 2000);
              }
              break;

            case 'MEDIATOR':
              sendStateUpdate('HANDLE_MEDIATOR');
              const actBtn = findActionableButton();
              if (actBtn) {
                sendLog("[SCRAPER] Clicking mediator action element (" + actBtn.score + "): " + actBtn.text);
                sessionState.clickedSelectors.push(actBtn.label);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'CLICK_ACTION',
                  selector: actBtn.label,
                  text: actBtn.text
                }));
                actBtn.el.click();
                // Re-evaluate page state after 4 seconds in case of inline state change / no navigation
                setTimeout(executeStateMachine, 4000);
              } else {
                // Enter RECOVERY mode before declaring failure
                sendStateUpdate('RECOVERY');
                sendLog("[SCRAPER] Mediator page had no actionable buttons. Rescanning DOM with loose rules...", 'warn');
                
                // Loose scanning
                const looseButtons = document.querySelectorAll('button, a, [role="button"]');
                let clickedLoose = false;
                for (let btn of looseButtons) {
                  const text = (btn.textContent || '').trim();
                  if (text.length > 2 && text.length < 25 && btn.getBoundingClientRect().width > 0) {
                    sendLog("[SCRAPER] Recovery: Clicking loose candidate: " + text);
                    const rect = btn.getBoundingClientRect();
                    const uniqueLabel = [btn.tagName.toLowerCase(), text.substring(0, 20), Math.round(rect.top), Math.round(rect.left)].join('_');
                    sessionState.clickedSelectors.push(uniqueLabel);
                    btn.click();
                    clickedLoose = true;
                    // Re-evaluate page state after 4 seconds in case of inline state change / no navigation
                    setTimeout(executeStateMachine, 4000);
                    break;
                  }
                }
                
                if (!clickedLoose) {
                  sendError("Mediator recovery failed. No clickable element found.");
                }
              }
              break;

            case 'MIRROR_PAGE':
              sendStateUpdate('EXTRACT_MIRRORS');
              sendLog("[SCRAPER] Target mirror page successfully resolved!", 'success');
              
              // Recalculate extracted links to return
              let finalLinks = [];
              scanElementTree(document.body, ['a'], (el) => {
                const href = el.getAttribute('href') || '';
                const text = (el.textContent || '').trim().replace(/\\s+/g, ' ');
                if (!href || href === '#' || href.startsWith('javascript:')) return;
                const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.href).toString();
                
                if (sessionRequest.targetType === 'mirrors') {
                  const isPromo = fullUrl.includes('t.me/') || fullUrl.includes('telegram.me') || fullUrl.includes('telegram.org') || /tutorial|how to/i.test(text);
                  const isMirror = (
                    fullUrl.includes('hubcloud') || 
                    fullUrl.includes('drive.google.com') || 
                    fullUrl.includes('mega.nz') || 
                    fullUrl.includes('pixeldrain.com') ||
                    /download|server|gdrive|direct|hubcloud|mega|pixeldrain|drive|gdtot/i.test(text)
                  ) && !isPromo;
                  if (isMirror && !finalLinks.some(l => l.url === fullUrl)) {
                    finalLinks.push({ label: text || 'Download Mirror', url: fullUrl });
                  }
                } else if (sessionRequest.targetType === 'direct-links') {
                  const isPromo = fullUrl.includes('t.me/') || 
                                  fullUrl.includes('telegram.me') || 
                                  fullUrl.includes('telegram.org') || 
                                  fullUrl.includes('telegram.dog') || 
                                  /tutorial|how to/i.test(text);
                  const isDirect = (
                    /download/i.test(text) || 
                    /direct/i.test(text) || 
                    /fsl/i.test(text) || 
                    /pixel/i.test(text) || 
                    /server/i.test(text) || 
                    /buzz/i.test(text) ||
                    fullUrl.includes('/download.php') ||
                    /\\.(mkv|mp4|avi|zip|rar)/i.test(fullUrl)
                  ) && !isPromo;
                  if (isDirect && !finalLinks.some(l => l.url === fullUrl)) {
                    finalLinks.push({ label: text || 'Direct Link', url: fullUrl });
                  }
                }
              });

              sendLog("[SCRAPER] Extracted " + finalLinks.length + " links.", 'success');
              sendSuccess(document.documentElement.outerHTML, window.location.href, finalLinks);
              break;

            case 'DIRECT_FILE_HOST':
              sendStateUpdate('RESOLVE_DIRECT_URL');
              sendLog("[SCRAPER] Direct downloadable host resolved!", 'success');
              
              let directUrl = window.location.href;
              // Check if we can find download link on page
              let foundFileUrl = '';
              scanElementTree(document.body, ['a'], (el) => {
                const href = el.getAttribute('href') || '';
                if (!href) return;
                const full = href.startsWith('http') ? href : new URL(href, window.location.href).toString();
                if (isDirectFileUrl(full)) {
                  foundFileUrl = full;
                }
              });
              
              if (foundFileUrl) {
                directUrl = foundFileUrl;
              } else if (activeStrategy && activeStrategy.name === 'PixelDrain') {
                const match = window.location.href.match(/(?:pixeldrain\\.com|pixeldrain\\.dev)\\/u\\/([a-zA-Z0-9_-]+)/);
                if (match) {
                  directUrl = 'https://pixeldrain.com/api/file/' + match[1] + '?download';
                }
              }

              sendSuccess(
                '<html><body><a href="' + directUrl + '">Direct Download</a></body></html>',
                window.location.href,
                [{ label: 'Direct Download', url: directUrl }]
              );
              break;

            default:
              sendStateUpdate('UNKNOWN');
              sendLog("[SCRAPER] Unknown page state. Idle waiting limit...", 'warn');
              setTimeout(executeStateMachine, 3000);
              break;
          }
        });
      }

      // Start state machine!
      executeStateMachine();
    })();
    true;
  `;
}
