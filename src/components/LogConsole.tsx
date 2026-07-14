import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { ScraperService, LogType } from '../services/scraper.service';

interface LogItem {
  message: string;
  type: LogType;
  id: string;
}

export const LogConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const scraper = ScraperService.getInstance();

  useEffect(() => {
    const handleLog = (message: string, type: LogType) => {
      setLogs(prev => [...prev.slice(-150), { message, type, id: Math.random().toString(36) }]);
    };

    scraper.addLogListener(handleLog);
    // Add default log
    scraper.log('Scraper Logging Console Initialized. Ready to crawl.', 'info');

    return () => {
      scraper.removeLogListener(handleLog);
    };
  }, [scraper]);

  const clearLogs = () => {
    setLogs([]);
    scraper.log('Console logs cleared.', 'info');
  };

  const getLogColor = (type: LogType) => {
    switch (type) {
      case 'success': return '#10b981'; // Green
      case 'warn': return '#f59e0b'; // Amber/Yellow
      case 'error': return '#ef4444'; // Red
      case 'info':
      default: return '#e2e8f0'; // Off-white
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dotContainer}>
          <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
          <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
          <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
        </View>
        <Text style={styles.headerText}>Crawler Terminal Logs</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={clearLogs}>
          <Text style={styles.clearBtnText}>CLEAR</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.terminal}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {logs.length === 0 ? (
          <Text style={[styles.logText, { color: '#64748b' }]}>No log entries...</Text>
        ) : (
          logs.map(log => (
            <Text key={log.id} style={[styles.logText, { color: getLogColor(log.type) }]}>
              {log.message}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 250,
    backgroundColor: '#0a0a0c',
    borderTopWidth: 1,
    borderTopColor: '#2d2d34',
    flexDirection: 'column',
  },
  header: {
    height: 35,
    backgroundColor: '#16161b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#22222b',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  clearBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#272730',
  },
  clearBtnText: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  terminal: {
    flex: 1,
    padding: 10,
    backgroundColor: '#0f0f13',
  },
  logText: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
    marginBottom: 4,
  },
});
export default LogConsole;
