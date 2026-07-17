import React, {useState, useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {WebView} from 'react-native-webview';
import {ScraperService} from '../services/scraper.service';
import {
  ScraperSessionRequest,
  ScraperSessionResult,
} from '../services/scraper.types';
import {getInjectedBeforeContentLoadedScript} from '../services/scraper/browser/injected';
import {ScraperEngine} from '../services/scraper/engine/ScraperEngine';

export const HiddenWebView: React.FC = () => {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const webViewRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const scraper = ScraperService.getInstance();

  const sessionRequestRef = useRef<ScraperSessionRequest | null>(null);
  const onSessionCompletedRef = useRef<
    ((result: ScraperSessionResult | null, error?: string) => void) | null
  >(null);
  const scraperEngineRef = useRef<ScraperEngine | null>(null);

  useEffect(() => {
    // Register trigger callback with the service
    scraper.registerWebViewTrigger((request, onCompleted) => {
      // Initialize active session refs
      sessionRequestRef.current = request;
      onSessionCompletedRef.current = onCompleted;

      const engine = new ScraperEngine(
        script => {
          webViewRef.current?.injectJavaScript(script);
        },
        (result, error) => {
          terminateSession(result, error);
        },
      );

      scraperEngineRef.current = engine;
      engine.startSession(request);

      scraper.log(
        `=== Multi-Stage WebView Scraper Session Started (ID: ${request.id}) ===`,
        'info',
      );
      setActiveUrl(request.url);
    });
  }, [scraper]);

  // Clean-up and termination helper
  const terminateSession = (
    result: ScraperSessionResult | null,
    error?: any,
  ) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (onSessionCompletedRef.current) {
      const errorPayload =
        typeof error === 'object' && error !== null
          ? JSON.stringify(error)
          : error;
      onSessionCompletedRef.current(result, errorPayload);
      onSessionCompletedRef.current = null;
    }
    sessionRequestRef.current = null;
    scraperEngineRef.current = null;
    setActiveUrl(null);
  };

  const handleSessionFailure = (reason: string) => {
    scraper.log(`FAILURE: ${reason}`, 'error');
    if (scraperEngineRef.current) {
      scraperEngineRef.current.stopSession(reason);
    } else {
      terminateSession(null, {
        type: 'WEBVIEW_SCRAPER_ERROR',
        message: reason,
      });
    }
  };

  const reportPortalAccessDenied = (errorDetail: {
    type: 'PORTAL_ACCESS_DENIED';
    statusCode: number;
    retryable: boolean;
    url: string;
    message?: string;
  }) => {
    scraper.log(
      `Portal rejected WebView request: HTTP ${errorDetail.statusCode}`,
      'warn',
    );
    scraper.log('Closing WebView scraper session cleanly', 'info');

    terminateSession(null, {
      type: 'PORTAL_ACCESS_DENIED',
      statusCode: errorDetail.statusCode,
      retryable: errorDetail.retryable,
      url: errorDetail.url,
      message: errorDetail.message || 'Portal rejected automated request',
    });
  };

  const reportHttpError = (errorDetail: {
    type: 'WEBVIEW_HTTP_ERROR';
    statusCode: number;
    retryable: boolean;
    message?: string;
  }) => {
    scraper.log(
      `WebView HTTP status error: Code ${errorDetail.statusCode}`,
      'error',
    );

    terminateSession(null, {
      type: 'WEBVIEW_HTTP_ERROR',
      statusCode: errorDetail.statusCode,
      retryable: errorDetail.retryable,
      message:
        errorDetail.message ||
        `WebView HTTP status error: Code ${errorDetail.statusCode}`,
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
        handleSessionFailure(
          `Scraper execution timed out (exceeded maxRuntime of ${maxRuntime}ms)`,
        );
      }, maxRuntime);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl]);

  if (!activeUrl) {
    return null;
  }

  const injectedJSBeforeContent = getInjectedBeforeContentLoadedScript();
  const WebViewComp = WebView as any;

  return (
    <View style={styles.container}>
      <WebViewComp
        ref={webViewRef}
        source={{uri: activeUrl}}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        injectedJavaScriptBeforeContentLoaded={injectedJSBeforeContent}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        mixContentMode="always"
        onMessage={(event: any) => {
          if (scraperEngineRef.current) {
            scraperEngineRef.current.handleBrowserMessage(
              event.nativeEvent.data,
            );
          }
        }}
        onError={(err: any) => {
          handleSessionFailure(
            `WebView content load error: ${
              err.nativeEvent.description || 'Load failed'
            }`,
          );
        }}
        onHttpError={(err: any) => {
          const statusCode = err.nativeEvent.statusCode;
          const currentUrl = err.nativeEvent.url || activeUrl || '';

          if (statusCode === 401 || statusCode === 403) {
            reportPortalAccessDenied({
              type: 'PORTAL_ACCESS_DENIED',
              statusCode,
              retryable: false,
              url: currentUrl,
            });
            return;
          }

          if (statusCode >= 400) {
            reportHttpError({
              type: 'WEBVIEW_HTTP_ERROR',
              statusCode,
              retryable: statusCode >= 500,
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
