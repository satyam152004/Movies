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
import {colors as COLORS, radius as RADIUS} from '../theme';

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
    scraper.log(
      'Scraper Engine Terminal Live. Diagnostic tools loaded.',
      'info',
    );

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
        return COLORS.success;
      case 'warn':
        return COLORS.warning;
      case 'error':
        return COLORS.danger;
      case 'info':
      default:
        return COLORS.textSecondary;
    }
  };

  const filteredLogs = logs.filter(log =>
    log.message.toLowerCase().includes(filterText.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      {/* VS Code styled Header */}
      <View style={styles.header}>
        <View style={styles.dotContainer}>
          <View style={[styles.dot, {backgroundColor: COLORS.danger}]} />
          <View style={[styles.dot, {backgroundColor: COLORS.warning}]} />
          <View style={[styles.dot, {backgroundColor: COLORS.success}]} />
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
          placeholder="Filter logs (e.g. error, click, bypass)..."
          placeholderTextColor={COLORS.textMuted}
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

      {/* Terminal Output Scroll */}
      <ScrollView
        style={styles.terminal}
        ref={scrollViewRef}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({animated: true})
        }
        showsVerticalScrollIndicator={true}>
        {filteredLogs.length === 0 ? (
          <Text
            style={[
              styles.logText,
              {color: COLORS.textMuted, fontStyle: 'italic'},
            ]}>
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
    borderTopColor: COLORS.border,
    flexDirection: 'column',
  },
  header: {
    height: 38,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    color: COLORS.textSecondary,
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
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearBtn: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  actionBtnText: {
    color: COLORS.textPrimary,
    fontSize: 8,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  filterBar: {
    height: 32,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  filterInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 10,
    fontFamily: 'monospace',
    height: '100%',
    padding: 0,
  },
  clearFilterBtn: {
    padding: 4,
  },
  clearFilterText: {
    color: COLORS.textMuted,
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
    color: COLORS.primary,
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
