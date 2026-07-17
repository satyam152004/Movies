/**
 * Injected JS agent which runs inside the WebView.
 * Exposes observation mechanisms and cmd execution capabilities.
 */
export function getInjectedBeforeContentLoadedScript(): string {
  return `
    (function() {
      if (window.__SCRAPER_AGENT_INITIALIZED__) return;
      window.__SCRAPER_AGENT_INITIALIZED__ = true;

      console.log("[SCRAPER_AGENT] Injected browser agent successfully.");

      // Active AJAX tracking for network-idle detection
      window.__activeAjaxCount__ = 0;
      
      const originalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function() {
          window.__activeAjaxCount__++;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NETWORK_BUSY',
            url: window.location.href,
            timestamp: Date.now(),
            activeRequests: window.__activeAjaxCount__
          }));
          return originalOpen.apply(xhr, arguments);
        };
        
        xhr.addEventListener('readystatechange', function() {
          if (xhr.readyState === 4) {
            window.__activeAjaxCount__ = Math.max(0, window.__activeAjaxCount__ - 1);
            if (window.__activeAjaxCount__ === 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'NETWORK_IDLE',
                url: window.location.href,
                timestamp: Date.now(),
                activeRequests: 0
              }));
            }
          }
        });
        
        return xhr;
      };

      const originalFetch = window.fetch;
      window.fetch = function() {
        window.__activeAjaxCount__++;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'NETWORK_BUSY',
          url: window.location.href,
          timestamp: Date.now(),
          activeRequests: window.__activeAjaxCount__
        }));

        return originalFetch.apply(this, arguments)
          .then(res => {
            window.__activeAjaxCount__ = Math.max(0, window.__activeAjaxCount__ - 1);
            if (window.__activeAjaxCount__ === 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'NETWORK_IDLE',
                url: window.location.href,
                timestamp: Date.now(),
                activeRequests: 0
              }));
            }
            return res;
          })
          .catch(err => {
            window.__activeAjaxCount__ = Math.max(0, window.__activeAjaxCount__ - 1);
            if (window.__activeAjaxCount__ === 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'NETWORK_IDLE',
                url: window.location.href,
                timestamp: Date.now(),
                activeRequests: 0
              }));
            }
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
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'COUNTDOWN_STARTED',
              url: window.location.href,
              timestamp: Date.now(),
              secondsLeft: Math.round(timeout / 1000)
            }));
          }
        } catch (e) {}

        const wrappedHandler = function() {
          if (isRedirectTimer) {
            window.__pendingRedirectTimers__ = Math.max(0, window.__pendingRedirectTimers__ - 1);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'COUNTDOWN_FINISHED',
              url: window.location.href,
              timestamp: Date.now()
            }));
          }
          if (typeof handler === 'string') {
            return eval(handler);
          }
          return handler.apply(this, arguments);
        };

        return originalSetTimeout(wrappedHandler, timeout);
      };

      // API Redirect interception
      const originalOpen = window.open;
      window.open = function(url, target, features) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'REDIRECT_ATTEMPT',
          url: url || '',
          timestamp: Date.now(),
          method: 'window.open'
        }));
        if (url) window.location.href = url;
        return null;
      };

      const originalAssign = window.location.assign;
      window.location.assign = function(url) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'REDIRECT_ATTEMPT',
          url: url || '',
          timestamp: Date.now(),
          method: 'location.assign'
        }));
        return originalAssign.apply(this, arguments);
      };

      const originalReplace = window.location.replace;
      window.location.replace = function(url) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'REDIRECT_ATTEMPT',
          url: url || '',
          timestamp: Date.now(),
          method: 'location.replace'
        }));
        return originalReplace.apply(this, arguments);
      };

      // History manipulation wrappers
      const originalPushState = window.history.pushState;
      window.history.pushState = function(state, title, url) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'HISTORY_CHANGE',
          url: url || '',
          timestamp: Date.now(),
          method: 'pushState'
        }));
        const ret = originalPushState.apply(this, arguments);
        setTimeout(triggerPageLoadAndStateScan, 100);
        return ret;
      };

      const originalReplaceState = window.history.replaceState;
      window.history.replaceState = function(state, title, url) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'HISTORY_CHANGE',
          url: url || '',
          timestamp: Date.now(),
          method: 'replaceState'
        }));
        const ret = originalReplaceState.apply(this, arguments);
        setTimeout(triggerPageLoadAndStateScan, 100);
        return ret;
      };

      window.addEventListener('popstate', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'URL_CHANGED',
          url: window.location.href,
          timestamp: Date.now(),
          method: 'popstate'
        }));
        setTimeout(triggerPageLoadAndStateScan, 100);
      });

      // HTML Form submission
      const originalSubmit = HTMLFormElement.prototype.submit;
      HTMLFormElement.prototype.submit = function() {
        this.removeAttribute('target'); // Ensure it stays in our WebView
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FORM_SUBMIT_ATTEMPT',
          url: window.location.href,
          timestamp: Date.now(),
          action: this.action || '',
          method: 'form.submit'
        }));
        return originalSubmit.apply(this, arguments);
      };

      // Handshake initiation
      function triggerPageLoadAndStateScan() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'HANDSHAKE_REQUEST',
          url: window.location.href,
          timestamp: Date.now(),
          title: document.title
        }));
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', triggerPageLoadAndStateScan);
      } else {
        triggerPageLoadAndStateScan();
      }

      // Mutation Observer tracking DOM changes
      let lastMutation = Date.now();
      let mutationDebounceTimer = null;
      
      const observer = new MutationObserver(() => {
        lastMutation = Date.now();
        if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
        
        mutationDebounceTimer = setTimeout(() => {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DOM_CHANGED',
            url: window.location.href,
            timestamp: Date.now()
          }));
        }, 500); // 500ms debounce
      });

      if (document.documentElement) {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
      }
    })();
    true;
  `;
}

/**
 * Returns helper functions executing dynamic DOM evaluations and actions.
 */
export function getAgentCommandAPI(): string {
  return `
    (function() {
      window.__SCRAPER_API__ = {
        getFingerprint: function() {
          try {
            const url = window.location.href;
            const title = document.title;
            const buttons = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));
            const buttonTexts = buttons.map(b => (b.textContent || b.value || '').trim()).filter(Boolean).join('|');
            const buttonCount = buttons.length;
            const formCount = document.querySelectorAll('form').length;
            const domHash = document.body ? document.body.innerHTML.length : 0;
            
            // Simple string hashing
            let str = [url, title, buttonCount, formCount, domHash, buttonTexts].join('_');
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
              hash = (hash << 5) - hash + str.charCodeAt(i);
              hash |= 0;
            }
            return Math.abs(hash).toString(16);
          } catch (e) {
            return 'error-fingerprint';
          }
        },

        findCandidates: function() {
          const candidates = [];
          const candidateLogs = [];
          const priorities = [
            { score: 100, regex: /continue|proceed/i },
            { score: 90, regex: /verify|captcha|confirm|human/i },
            { score: 80, regex: /next/i },
            { score: 70, regex: /get\s*link/i },
            { score: 65, regex: /download/i },
            { score: 50, regex: /watch|stream|play/i },
            { score: 40, regex: /server|mirror|buzz|fsl/i }
          ];

          function scan(node) {
            if (!node) return;
            if (node.nodeType === Node.ELEMENT_NODE) {
              const tagName = node.tagName.toLowerCase();
              const role = node.getAttribute('role') || '';
              const onclick = node.getAttribute('onclick') || '';
              const isClickableTag = ['a', 'button', 'input'].includes(tagName);
              
              let style = null;
              try {
                style = window.getComputedStyle(node);
              } catch(e) {}
              
              const hasCursorPointer = style && style.cursor === 'pointer';
              const hasClickAttr = onclick || node.hasAttribute('ng-click') || node.hasAttribute('@click') || node.hasAttribute('v-on:click');
              
              const isCandidateTag = isClickableTag || ['div', 'span', 'li', 'p'].includes(tagName);
              const isInteractive = isClickableTag || role === 'button' || role === 'link' || hasCursorPointer || hasClickAttr;

              if (isCandidateTag) {
                try {
                  const rect = node.getBoundingClientRect();
                  const visible = rect.width > 0 && rect.height > 0 && style && style.display !== 'none' && style.visibility !== 'hidden';
                  const disabled = node.disabled || node.classList.contains('disabled') || node.getAttribute('aria-disabled') === 'true' || (style && style.pointerEvents === 'none');
                  const text = (node.textContent || node.value || '').trim().replace(/\s+/g, ' ');

                  if (!visible) {
                    if (isInteractive && text) {
                      candidateLogs.push({ tagName, text, accepted: false, reason: 'Element is not visible or has zero size' });
                    }
                  } else if (disabled) {
                    if (isInteractive && text) {
                      candidateLogs.push({ tagName, text, accepted: false, reason: 'Element is disabled or pointer-events: none' });
                    }
                  } else if (!text && !onclick && !isClickableTag) {
                    // skip empty containers
                  } else {
                    // Prevent selecting parent containers if they contain any child element that is also interactive
                    let hasInteractiveChild = false;
                    try {
                      hasInteractiveChild = node.querySelector('a, button, input, [role="button"], [role="link"]') !== null;
                    } catch(e) {}

                    if (hasInteractiveChild && !isClickableTag) {
                      candidateLogs.push({ tagName, text: text.substring(0, 30) + '...', accepted: false, reason: 'Skipped container because it has interactive child elements' });
                    } else {
                      let cleanLink = true;
                      if (tagName === 'a') {
                        const href = node.getAttribute('href') || '';
                        if (/ad-|popads|propeller|clicktrack|promo/i.test(href)) {
                          cleanLink = false;
                          candidateLogs.push({ tagName, text, accepted: false, reason: 'Link matches ad patterns: ' + href });
                        }
                      }

                      if (cleanLink) {
                        const uniqueLabel = [tagName, text.substring(0, 20), Math.round(rect.top), Math.round(rect.left)].join('_');
                        let score = 0;
                        let matchedRegex = '';
                        
                        for (let priority of priorities) {
                          if (priority.regex.test(text) || (role && priority.regex.test(role))) {
                            score = priority.score;
                            matchedRegex = priority.regex.toString();
                            break;
                          }
                        }
                        
                        if (score === 0 && (onclick || hasCursorPointer || isClickableTag)) {
                          if (/continue|proceed|verify|next|link|download|server|mirror/i.test(text || onclick)) {
                            score = 20;
                            matchedRegex = 'fallback keyword';
                          }
                        }
                        
                        // Penalize non-genuine interactive tags if they are large or have huge texts
                        if (score > 0 && !isInteractive) {
                          if (text.length > 50 || rect.width > 250 || rect.height > 80) {
                            score -= 50; // Heavily penalize large informational containers
                            matchedRegex += ' (penalized due to size/non-interactive tag)';
                          }
                        }

                        if (score > 0) {
                          candidates.push({
                            tagName: tagName,
                            text: text,
                            label: uniqueLabel,
                            score: score,
                            rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
                          });
                          candidateLogs.push({
                            tagName,
                            text,
                            label: uniqueLabel,
                            accepted: true,
                            score,
                            reason: 'Matched ' + matchedRegex
                          });
                        } else if (isInteractive && text) {
                          candidateLogs.push({
                            tagName,
                            text,
                            accepted: false,
                            reason: 'No keywords matched interactive element'
                          });
                        }
                      }
                    }
                  }
                } catch(e) {}
              }

              if (node.shadowRoot) scan(node.shadowRoot);
              if (tagName === 'iframe') {
                try {
                  if (node.contentDocument) scan(node.contentDocument.body || node.contentDocument.documentElement);
                } catch(e) {}
              }
            }
            for (let child of node.childNodes) {
              scan(child);
            }
          }

          if (document.body) scan(document.body);
          
          console.log("[SCRAPER_AGENT] Candidate evaluation log: " + JSON.stringify(candidateLogs));
          return { candidates, logs: candidateLogs };
        },

        getCompactSnapshot: function() {
          const snapshot = {
            title: document.title,
            visibleButtons: [],
            visibleLinks: [],
            forms: [],
            inputs: []
          };
          
          try {
            document.querySelectorAll('button, a, form, input').forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                const tag = el.tagName.toLowerCase();
                const text = (el.textContent || el.value || '').trim().replace(/\s+/g, ' ');
                
                if (tag === 'button' || (tag === 'input' && ['button', 'submit'].includes(el.type))) {
                  snapshot.visibleButtons.push({ text, type: el.type, rect: { x: rect.left, y: rect.top } });
                } else if (tag === 'a') {
                  snapshot.visibleLinks.push({ text, href: el.getAttribute('href'), rect: { x: rect.left, y: rect.top } });
                } else if (tag === 'form') {
                  snapshot.forms.push({ action: el.getAttribute('action'), method: el.getAttribute('method') });
                } else if (tag === 'input') {
                  snapshot.inputs.push({ type: el.type, name: el.name, placeholder: el.placeholder });
                }
              }
            });
          } catch(e) {}
          
          return snapshot;
        },

        executeCommand: function(cmd) {
          try {
            console.log("[SCRAPER_AGENT] Executing RN command: " + cmd.type + " with details: " + JSON.stringify(cmd));
            if (cmd.type === 'CLICK') {
              const result = this.findCandidates();
              const target = result.candidates.find(c => c.label === cmd.selector);
              if (target) {
                let nodeToClick = null;
                function locate(node) {
                  if (nodeToClick) return;
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    const rect = node.getBoundingClientRect();
                    const text = (node.textContent || node.value || '').trim().replace(/\s+/g, ' ');
                    const uniqueLabel = [node.tagName.toLowerCase(), text.substring(0, 20), Math.round(rect.top), Math.round(rect.left)].join('_');
                    if (uniqueLabel === cmd.selector) {
                      nodeToClick = node;
                      return;
                    }
                    if (node.shadowRoot) locate(node.shadowRoot);
                    if (node.tagName.toLowerCase() === 'iframe') {
                      try {
                        if (node.contentDocument) locate(node.contentDocument.body || node.contentDocument.documentElement);
                      } catch(e) {}
                    }
                  }
                  for (let child of node.childNodes) {
                    locate(child);
                  }
                }
                locate(document.body);
                if (nodeToClick) {
                  // High-fidelity human-like click sequence
                  nodeToClick.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  
                  console.log("[SCRAPER_AGENT] Dispatching high-fidelity click to: " + target.text + " selector: " + cmd.selector);
                  
                  const opts = { bubbles: true, cancelable: true, view: window };
                  nodeToClick.dispatchEvent(new MouseEvent('mouseover', opts));
                  nodeToClick.dispatchEvent(new PointerEvent('pointerover', opts));
                  nodeToClick.dispatchEvent(new PointerEvent('pointerdown', opts));
                  nodeToClick.dispatchEvent(new MouseEvent('mousedown', opts));
                  try {
                    nodeToClick.focus();
                  } catch(e) {}
                  nodeToClick.dispatchEvent(new PointerEvent('pointerup', opts));
                  nodeToClick.dispatchEvent(new MouseEvent('mouseup', opts));
                  
                  nodeToClick.click();
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'BUTTON_CLICKED',
                    url: window.location.href,
                    timestamp: Date.now(),
                    buttonSelector: cmd.selector,
                    buttonText: target.text
                  }));
                  return true;
                }
              }
              return false;
            } else if (cmd.type === 'SCROLL') {
              window.scrollBy({ top: 300, behavior: 'smooth' });
              return true;
            } else if (cmd.type === 'GET_FINGERPRINT') {
              const fingerprint = this.getFingerprint();
              const result = this.findCandidates();
              const bodyText = document.body ? document.body.innerText : '';
              
              let snapshot = null;
              if (result.candidates.length === 0) {
                snapshot = this.getCompactSnapshot();
              }
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DOM_CHANGED',
                url: window.location.href,
                timestamp: Date.now(),
                fingerprint: fingerprint,
                candidates: result.candidates,
                candidateLogs: result.logs,
                compactSnapshot: snapshot,
                bodyText: bodyText,
                title: document.title,
                html: document.documentElement.outerHTML
              }));
              return true;
            }
            return false;
          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              url: window.location.href,
              timestamp: Date.now(),
              message: 'API error: ' + e.message
            }));
            return false;
          }
        }

      };
    })();
    true;
  `;
}
