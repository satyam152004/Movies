import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
} from 'react-native';
import {DownloadService, DownloadRecord} from '../services/download.service';

interface DownloadManagerProps {
  onBack: () => void;
}

export const DownloadManagerScreen: React.FC<DownloadManagerProps> = ({
  onBack,
}) => {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    // Register listener for real-time status updates from the service
    const service = DownloadService.getInstance();
    const unsubscribe = (list: DownloadRecord[]) => {
      setDownloads(list);
    };

    service.addListener(unsubscribe);

    // Hardware back button behavior
    const backAction = () => {
      onBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => {
      service.removeListener(unsubscribe);
      backHandler.remove();
    };
  }, [onBack]);

  const handlePause = (id: string) => {
    DownloadService.getInstance().pauseDownload(id);
  };

  const handleResume = (id: string) => {
    DownloadService.getInstance().resumeDownload(id);
  };

  const handleCancel = (id: string) => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download?',
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Yes',
          onPress: () => {
            DownloadService.getInstance().cancelDownload(id);
          },
        },
      ],
    );
  };

  const handleRemove = (id: string) => {
    Alert.alert('Delete Record', 'Remove this download record from history?', [
      {text: 'No', style: 'cancel'},
      {
        text: 'Yes',
        onPress: () => {
          DownloadService.getInstance().removeDownloadRecord(id);
        },
      },
    ]);
  };

  const toggleLogs = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return styles.statusBadgeCompleted;
      case 'paused':
        return styles.statusBadgePaused;
      case 'cancelled':
        return styles.statusBadgeCancelled;
      case 'failed':
        return styles.statusBadgeFailed;
      case 'pending':
        return styles.statusBadgePending;
      default:
        return styles.statusBadgeDownloading;
    }
  };

  const activeCount = downloads.filter(
    d => d.status === 'downloading' || d.status === 'pending',
  ).length;
  const completedCount = downloads.filter(d => d.status === 'completed').length;
  const failedCount = downloads.filter(
    d => d.status === 'failed' || d.status === 'cancelled',
  ).length;

  const getLogRowColor = (log: string) => {
    const lower = log.toLowerCase();
    if (lower.includes('error') || lower.includes('failed')) {
      return '#EF4444';
    }
    if (
      lower.includes('success') ||
      lower.includes('completed') ||
      lower.includes('enqueued')
    ) {
      return '#10B981';
    }
    if (
      lower.includes('warn') ||
      lower.includes('paused') ||
      lower.includes('cancel')
    ) {
      return '#F59E0B';
    }
    if (lower.includes('resuming') || lower.includes('retrying')) {
      return '#8B5CF6';
    }
    return '#94A3B8';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onBack}
          activeOpacity={0.7}>
          <Text style={styles.closeBtnText}>◀ BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Download Pipeline</Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>
        {/* Storage / Summary Cards */}
        {downloads.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, {color: '#8B5CF6'}]}>
                {activeCount}
              </Text>
              <Text style={styles.summaryLabel}>ACTIVE</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, {color: '#10B981'}]}>
                {completedCount}
              </Text>
              <Text style={styles.summaryLabel}>COMPLETED</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, {color: '#94A3B8'}]}>
                {failedCount}
              </Text>
              <Text style={styles.summaryLabel}>FAILED</Text>
            </View>
          </View>
        )}

        {downloads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📥</Text>
            <Text style={styles.emptyText}>
              No active or completed downloads
            </Text>
            <Text style={styles.emptySubtext}>
              Resolved movie links you download will appear in this pipeline.
            </Text>
          </View>
        ) : (
          downloads.map(item => {
            const isExpanded = expandedLogId === item.id;
            const progressPercent = item.progress.toFixed(1);

            return (
              <View key={item.id} style={styles.downloadCard}>
                {/* File Details */}
                <View style={styles.fileRow}>
                  <Text style={styles.fileIcon}>🎬</Text>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={2}>
                      {item.movieTitle}
                    </Text>
                    <Text style={styles.fileSizeText}>
                      Spec Size:{' '}
                      <Text style={styles.highlightText}>{item.fileSize}</Text>
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteRecordBtn}
                    onPress={() => handleRemove(item.id)}
                    activeOpacity={0.7}>
                    <Text style={styles.deleteRecordIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                {/* Progress Header */}
                <View style={styles.progressHeader}>
                  <Text style={styles.percentText}>{progressPercent}%</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      getStatusBadgeStyle(item.status),
                    ]}>
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {color: getStatusBadgeStyle(item.status).color},
                      ]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.barContainer}>
                  <View
                    style={[styles.barFiller, {width: `${item.progress}%`}]}
                  />
                </View>

                {/* Metrics */}
                {item.status === 'downloading' && (
                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>SPEED</Text>
                      <Text style={styles.metricValue}>
                        {item.downloadSpeed}
                      </Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>DOWNLOADED</Text>
                      <Text style={styles.metricValue}>
                        {item.downloadedSize}
                      </Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>ETA</Text>
                      <Text style={styles.metricValue}>{item.eta}</Text>
                    </View>
                  </View>
                )}

                {/* Inline Controls */}
                <View style={styles.controlsRow}>
                  <View style={styles.actionButtons}>
                    {item.status === 'downloading' ||
                    item.status === 'pending' ? (
                      <>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.pauseBtn]}
                          onPress={() => handlePause(item.id)}
                          activeOpacity={0.8}>
                          <Text style={styles.actionBtnText}>⏸ Pause</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.cancelBtn]}
                          onPress={() => handleCancel(item.id)}
                          activeOpacity={0.8}>
                          <Text style={styles.actionBtnText}>🛑 Cancel</Text>
                        </TouchableOpacity>
                      </>
                    ) : item.status === 'paused' ? (
                      <>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.resumeBtn]}
                          onPress={() => handleResume(item.id)}
                          activeOpacity={0.8}>
                          <Text style={styles.actionBtnText}>▶ Resume</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.cancelBtn]}
                          onPress={() => handleCancel(item.id)}
                          activeOpacity={0.8}>
                          <Text style={styles.actionBtnText}>🛑 Cancel</Text>
                        </TouchableOpacity>
                      </>
                    ) : item.status === 'failed' ||
                      item.status === 'cancelled' ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.retryBtn]}
                        onPress={() => handleResume(item.id)}
                        activeOpacity={0.8}>
                        <Text style={styles.actionBtnText}>🔄 Retry Task</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.completedPlaceholder}>
                        <Text style={styles.completedText}>
                          ✨ Saved Successfully
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.toggleLogBtn}
                    onPress={() => toggleLogs(item.id)}
                    activeOpacity={0.7}>
                    <Text style={styles.toggleLogBtnText}>
                      {isExpanded ? '▼ LOGS' : '▲ LOGS'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Expandable Logs */}
                {isExpanded && (
                  <View style={styles.logsBox}>
                    <ScrollView
                      style={styles.logsScroll}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}>
                      {item.logs.map((log, idx) => (
                        <Text
                          key={idx}
                          style={[styles.logRow, {color: getLogRowColor(log)}]}>
                          {log}
                        </Text>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080A',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#101014',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(22, 22, 28, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 1,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.8,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  downloadCard: {
    backgroundColor: 'rgba(22, 22, 28, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    fontSize: 22,
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  fileSizeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  highlightText: {
    color: '#8B5CF6',
    fontWeight: '700',
  },
  deleteRecordBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  deleteRecordIcon: {
    fontSize: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900',
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadgeDownloading: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    color: '#06B6D4',
  },
  statusBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#10B981',
  },
  statusBadgePaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: '#F59E0B',
  },
  statusBadgeCancelled: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    color: '#94A3B8',
  },
  statusBadgeFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    color: '#8B5CF6',
  },
  barContainer: {
    height: 8,
    backgroundColor: '#0F0F13',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  barFiller: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#0F0F13',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  pauseBtn: {
    backgroundColor: '#F59E0B',
  },
  resumeBtn: {
    backgroundColor: '#10B981',
  },
  cancelBtn: {
    backgroundColor: '#EF4444',
  },
  retryBtn: {
    backgroundColor: '#8B5CF6',
  },
  completedPlaceholder: {
    justifyContent: 'center',
  },
  completedText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
  },
  toggleLogBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  toggleLogBtnText: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logsBox: {
    backgroundColor: '#050508',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 10,
    maxHeight: 130,
  },
  logsScroll: {
    flex: 1,
  },
  logRow: {
    fontSize: 9,
    fontFamily: 'monospace',
    lineHeight: 14,
    marginBottom: 3,
  },
});
