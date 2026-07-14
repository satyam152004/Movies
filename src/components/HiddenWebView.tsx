import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ScraperService } from '../services/scraper.service';
import { ScraperSessionRequest, ScraperSessionResult, ScraperPageState } from '../services/scraper.types';
import { getInjectedBeforeContentLoadedScript, getEngineExecutionScript } from '../services/scraper.script';

interface SessionState {
  redirectCount: number;
  clickCount: number;
  history: string[];
  visitedUrls: string[];
  detectedStrategies: string[];
  stateTransitions: string[];
  warnings: string[];
  startTime: number;
  clickedSelectors: string[];
}

export const HiddenWebView: React.FC = () => {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  
  const webViewRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const scraper = ScraperService.getInstance();

  const sessionRequestRef = useRef<ScraperSessionRequest | null>(null);
  const onSessionCompletedRef = useRef<((result: ScraperSessionResult | null, error?: string) => void) | null>(null);
  
  // High-frequency thread-safe session state reference
  const sessionStateRef = useRef<SessionState>({
    redirectCount: 0,
    clickCount: 0,
    history: [],
    visitedUrls: [],
    detectedStrategies: [],
    stateTransitions: [],
    warnings: [],
    startTime: 0,
    clickedSelectors: []
  });

  useEffect(() => {
    // Register trigger callback with the service
    scraper.registerWebViewTrigger((request, onCompleted) => {
      // Initialize active session refs
      sessionRequestRef.current = request;
      onSessionCompletedRef.current = onCompleted;
      
      sessionStateRef.current = {
        redirectCount: 0,
        clickCount: 0,
        history: ['Session Init'],
        visitedUrls: [request.url],
        detectedStrategies: [],
        stateTransitions: ['INIT'],
        warnings: [],
        startTime: Date.now(),
        clickedSelectors: []
      };

      scraper.log(`=== Multi-Stage WebView Scraper Session Started (ID: ${request.id}) ===`, 'info');
      setActiveUrl(request.url);
    });
  }, [scraper]);

  // Clean-up and termination helper
  const terminateSession = (result: ScraperSessionResult | null, error?: any) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (onSessionCompletedRef.current) {
      const errorPayload = typeof error === 'object' && error !== null ? JSON.stringify(error) : error;
      onSessionCompletedRef.current(result, errorPayload);
      onSessionCompletedRef.current = null;
    }
    sessionRequestRef.current = null;
    setActiveUrl(null);
  };

  const handleSessionFailure = (reason: string) => {
    const elapsed = ((Date.now() - sessionStateRef.current.startTime) / 1000).toFixed(3);
    scraper.log(`[${elapsed}] FAILURE: ${reason}`, 'error');
    terminateSession(null, {
      type: 'WEBVIEW_SCRAPER_ERROR',
      message: reason
    });
  };

  const reportPortalAccessDenied = (errorDetail: {
    type: 'PORTAL_ACCESS_DENIED';
    statusCode: number;
    retryable: boolean;
    url: string;
    message?: string;
  }) => {
    scraper.log(`Portal rejected WebView request: HTTP ${errorDetail.statusCode}`, 'warn');
    scraper.log('Closing WebView scraper session cleanly', 'info');
    
    terminateSession(null, {
      type: 'PORTAL_ACCESS_DENIED',
      statusCode: errorDetail.statusCode,
      retryable: errorDetail.retryable,
      url: errorDetail.url,
      message: errorDetail.message || 'Portal rejected automated request'
    });
  };

  const reportHttpError = (errorDetail: {
    type: 'WEBVIEW_HTTP_ERROR';
    statusCode: number;
    retryable: boolean;
    message?: string;
  }) => {
    scraper.log(`WebView HTTP status error: Code ${errorDetail.statusCode}`, 'error');
    
    terminateSession(null, {
      type: 'WEBVIEW_HTTP_ERROR',
      statusCode: errorDetail.statusCode,
      retryable: errorDetail.retryable,
      message: errorDetail.message || `WebView HTTP status error: Code ${errorDetail.statusCode}`
    });
  };

  // Enforce Max Runtime global limit
  useEffect(() => {
    if (activeUrl) {
      const maxRuntime = sessionRequestRef.current?.maxRuntime || 90000;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        handleSessionFailure(`Scraper execution timed out (exceeded maxRuntime of ${maxRuntime}ms)`);
      }, maxRuntime);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeUrl]);

  if (!activeUrl) return null;

  const injectedJSBeforeContent = getInjectedBeforeContentLoadedScript();
  const WebViewComp = WebView as any;

  return (
    <View style={styles.container}>
      <WebViewComp
        ref={webViewRef}
        source={{ uri: activeUrl }}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        injectedJavaScriptBeforeContentLoaded={injectedJSBeforeContent}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        mixContentMode="always"
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            const elapsed = ((Date.now() - sessionStateRef.current.startTime) / 1000).toFixed(3);
            
            if (!data.type) return;

            switch (data.type) {
              case 'HANDSHAKE_REQUEST': {
                // Intercept navigation page load step
                const state = sessionStateRef.current;
                state.redirectCount += 1;
                state.history.push(`NAVIGATION -> ${data.url}`);
                if (!state.visitedUrls.includes(data.url)) {
                  state.visitedUrls.push(data.url);
                }

                // Check depth limits
                if (state.redirectCount > (sessionRequestRef.current?.maxRedirects || 25)) {
                  handleSessionFailure(`Hops depth exceeded max limit (${sessionRequestRef.current?.maxRedirects || 25})`);
                  return;
                }

                scraper.log(`[${elapsed}] NAVIGATION -> ${data.url}`, 'info');

                // Handshake response: Send active parameters and state definition
                const runScript = getEngineExecutionScript(
                  JSON.stringify(sessionRequestRef.current),
                  JSON.stringify(state)
                );
                webViewRef.current?.injectJavaScript(runScript);
                break;
              }

              case 'REDIRECT_ATTEMPT': {
                const state = sessionStateRef.current;
                state.history.push(`REDIRECT (${data.method}) -> ${data.url}`);
                scraper.log(`[${elapsed}] REDIRECT (${data.method}) -> ${data.url}`, 'info');
                break;
              }

              case 'HISTORY_CHANGE': {
                const state = sessionStateRef.current;
                state.history.push(`HISTORY CHANGE (${data.method}) -> ${data.url}`);
                scraper.log(`[${elapsed}] HISTORY CHANGE (${data.method}) -> ${data.url}`, 'info');
                break;
              }

              case 'FORM_SUBMIT_ATTEMPT': {
                const state = sessionStateRef.current;
                state.history.push(`FORM SUBMIT -> ${data.action}`);
                scraper.log(`[${elapsed}] FORM SUBMIT -> ${data.action}`, 'info');
                break;
              }

              case 'STATE_TRANSITION': {
                const state = sessionStateRef.current;
                state.stateTransitions.push(data.state);
                
                let detailsStr = '';
                if (data.details) {
                  detailsStr = ` (${data.details})`;
                }
                
                state.history.push(`${data.state}${detailsStr}`);
                scraper.log(`[${elapsed}] ${data.state}${detailsStr}`, 'info');
                break;
              }

              case 'CLICK_ACTION': {
                const state = sessionStateRef.current;
                state.clickCount += 1;
                state.clickedSelectors.push(data.selector);
                
                state.history.push(`CLICK -> ${data.text}`);
                scraper.log(`[${elapsed}] CLICK -> ${data.text}`, 'success');

                if (state.clickCount > (sessionRequestRef.current?.maxClicks || 40)) {
                  handleSessionFailure(`Click action limit exceeded (${sessionRequestRef.current?.maxClicks || 40})`);
                }
                break;
              }

              case 'LOG': {
                scraper.log(`[${elapsed}] ${data.message}`, data.logType || 'info');
                break;
              }

              case 'SUCCESS': {
                const state = sessionStateRef.current;
                const totalDuration = Date.now() - state.startTime;
                
                scraper.log(`[${elapsed}] SUCCESS -> Final mirrors resolved!`, 'success');

                const sessionResult: ScraperSessionResult = {
                  html: data.html,
                  finalUrl: data.url,
                  pageType: 'SUCCESS',
                  redirectCount: state.redirectCount,
                  clickCount: state.clickCount,
                  mirrorCount: data.mirrors ? data.mirrors.length : 0,
                  duration: totalDuration,
                  history: state.history,
                  diagnostics: {
                    visitedUrls: state.visitedUrls,
                    detectedStrategies: state.detectedStrategies,
                    stateTransitions: state.stateTransitions,
                    warnings: state.warnings
                  },
                  mirrors: data.mirrors
                };

                terminateSession(sessionResult);
                break;
              }

              case 'ERROR': {
                handleSessionFailure(data.message || 'Scraper failed on page machine execution');
                break;
              }
            }
          } catch (e: any) {
            scraper.log(`Failed to process WebView message: ${e.message}`, 'error');
          }
        }}
        onError={(err: any) => {
          handleSessionFailure(`WebView content load error: ${err.nativeEvent.description || 'Load failed'}`);
        }}
        onHttpError={(err: any) => {
          const statusCode = err.nativeEvent.statusCode;
          const currentUrl = err.nativeEvent.url || activeUrl || '';
          
          if (statusCode === 401 || statusCode === 403) {
            reportPortalAccessDenied({
              type: 'PORTAL_ACCESS_DENIED',
              statusCode,
              retryable: false,
              url: currentUrl
            });
            return;
          }

          if (statusCode >= 400) {
            reportHttpError({
              type: 'WEBVIEW_HTTP_ERROR',
              statusCode,
              retryable: statusCode >= 500
            });
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 0,
    height: 0,
    position: 'absolute',
    opacity: 0,
  },
});

export default HiddenWebView;
