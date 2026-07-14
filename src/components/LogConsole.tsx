import React, {useState, useEffect, useRef} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Clipboard,
  Alert,
} from 'react-native';
import {ScraperService, LogType} from '../services/scraper.service';

interface LogItem {
  message: string;
  type: LogType;
  id: string;
}

export const LogConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const scraper = ScraperService.getInstance();

  useEffect(() => {
    const handleLog = (message: string, type: LogType) => {
      setLogs(prev => [
        ...prev.slice(-150),
        {message, type, id: Math.random().toString(36)},
      ]);
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

  const copyLogs = () => {
    if (logs.length === 0) {
      return;
    }
    const logDump = logs
      .map(l => `[${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');
    Clipboard.setString(logDump);
    Alert.alert('Logs Copied', 'All console log entries successfully copied.');
  };

  const getLogColor = (type: LogType) => {
    switch (type) {
      case 'success':
        return '#10B981'; // Green
      case 'warn':
        return '#F59E0B'; // Amber
      case 'error':
        return '#EF4444'; // Red
      case 'info':
      default:
        return '#94A3B8'; // Muted grey
    }
  };

  const filteredLogs = logs.filter(log =>
    log.message.toLowerCase().includes(filterText.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      {/* VS Code Header */}
      <View style={styles.header}>
        <View style={styles.dotContainer}>
          <View style={[styles.dot, {backgroundColor: '#EF4444'}]} />
          <View style={[styles.dot, {backgroundColor: '#F59E0B'}]} />
          <View style={[styles.dot, {backgroundColor: '#10B981'}]} />
        </View>
        <Text style={styles.headerText}>crawler_terminal.log</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={copyLogs}
            disabled={logs.length === 0}
            activeOpacity={0.7}>
            <Text style={styles.actionBtnText}>COPY</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.clearBtn]}
            onPress={clearLogs}
            activeOpacity={0.7}>
            <Text style={styles.actionBtnText}>CLEAR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Logs Filter */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.filterInput}
          value={filterText}
          onChangeText={setFilterText}
          placeholder="Filter logs (e.g. error, click, redirect)..."
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {filterText.length > 0 && (
          <TouchableOpacity
            onPress={() => setFilterText('')}
            style={styles.clearFilterBtn}>
            <Text style={styles.clearFilterText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Terminal Output */}
      <ScrollView
        style={styles.terminal}
        ref={scrollViewRef}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({animated: true})
        }
        showsVerticalScrollIndicator={true}>
        {filteredLogs.length === 0 ? (
          <Text
            style={[styles.logText, {color: '#475569', fontStyle: 'italic'}]}>
            {filterText
              ? 'No matching logs found.'
              : 'Terminal ready. No log entries...'}
          </Text>
        ) : (
          filteredLogs.map(log => (
            <View key={log.id} style={styles.logLineRow}>
              <Text style={styles.promptSymbol}>$</Text>
              <Text style={[styles.logText, {color: getLogColor(log.type)}]}>
                {log.message}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 230,
    backgroundColor: '#050508',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'column',
  },
  header: {
    height: 38,
    backgroundColor: '#0F0F13',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  headerText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  clearBtn: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  actionBtnText: {
    color: '#F8FAFC',
    fontSize: 8,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  filterBar: {
    height: 32,
    backgroundColor: '#0A0A0E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  filterInput: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 10,
    fontFamily: 'monospace',
    height: '100%',
    padding: 0,
  },
  clearFilterBtn: {
    padding: 4,
  },
  clearFilterText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: 'bold',
  },
  terminal: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#050508',
  },
  logLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  promptSymbol: {
    color: '#8B5CF6',
    fontSize: 10,
    fontFamily: 'monospace',
    marginRight: 6,
    fontWeight: '700',
  },
  logText: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'monospace',
    lineHeight: 15,
  },
});

export default LogConsole;
