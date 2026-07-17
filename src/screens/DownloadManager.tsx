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
import {colors, radius, spacing, typography} from '../theme';
import {DownloadCard} from '../components/cards/DownloadCard';
import {Container} from '../components/layout/Container';
import {EmptyState} from '../components/feedback/EmptyState';

interface DownloadManagerProps {
  onBack: () => void;
}

type TabType = 'active' | 'queue' | 'completed' | 'failed';

export const DownloadManagerScreen: React.FC<DownloadManagerProps> = ({
  onBack,
}) => {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    const service = DownloadService.getInstance();
    const unsubscribe = (list: DownloadRecord[]) => {
      setDownloads(list);
    };

    service.addListener(unsubscribe);

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

  // Map Service Record to Domain Task type
  const mapRecordToTask = (record: DownloadRecord) => {
    return {
      id: record.id,
      movieTitle: record.movieTitle,
      fileSize: record.fileSize,
      downloadUrl: record.downloadUrl,
      progress: record.progress,
      status: record.status as any,
      downloadSpeed: record.downloadSpeed,
      downloadedSize: record.downloadedSize,
      eta: record.eta,
      logs: record.logs,
    };
  };

  const filteredTasks = downloads.map(mapRecordToTask).filter(task => {
    if (activeTab === 'active') {
      return task.status === 'downloading' || task.status === 'paused';
    }
    if (activeTab === 'queue') {
      return task.status === 'pending';
    }
    if (activeTab === 'completed') {
      return task.status === 'completed';
    }
    if (activeTab === 'failed') {
      return task.status === 'failed' || task.status === 'cancelled';
    }
    return false;
  });

  const getEmptyStateMessage = () => {
    switch (activeTab) {
      case 'active':
        return {
          icon: '⚡',
          title: 'No Active Downloads',
          desc: 'Trigger new downloads from movie details cards to see active downloads here.',
        };
      case 'queue':
        return {
          icon: '⏳',
          title: 'Queue is Empty',
          desc: 'Pending downloads in line for network bandwidth will show here.',
        };
      case 'completed':
        return {
          icon: '✨',
          title: 'No Completed Files',
          desc: 'Successfully bypassed and compiled movie files are kept here.',
        };
      case 'failed':
        return {
          icon: '❌',
          title: 'No Failed Tasks',
          desc: 'Failed downloads requiring re-authentication or resume tokens appear here.',
        };
    }
  };

  const counts = {
    active: downloads.filter(
      d => d.status === 'downloading' || d.status === 'paused',
    ).length,
    queue: downloads.filter(d => d.status === 'pending').length,
    completed: downloads.filter(d => d.status === 'completed').length,
    failed: downloads.filter(
      d => d.status === 'failed' || d.status === 'cancelled',
    ).length,
  };

  const emptyMsg = getEmptyStateMessage();

  return (
    <Container style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onBack}
          activeOpacity={0.7}>
          <Text style={styles.closeBtnText}>◀ BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Download Hub</Text>
        <View style={styles.spacer} />
      </View>

      {/* Tabs Menu */}
      <View style={styles.tabsWrapper}>
        {(['active', 'queue', 'completed', 'failed'] as TabType[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}>
              {tab.toUpperCase()}
            </Text>
            {counts[tab] > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  activeTab === tab && styles.tabBadgeActive,
                ]}>
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === tab && styles.tabBadgeTextActive,
                  ]}>
                  {counts[tab]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={emptyMsg.icon}
          title={emptyMsg.title}
          description={emptyMsg.desc}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          {filteredTasks.map(task => (
            <DownloadCard
              key={task.id}
              task={task}
              onPause={() => handlePause(task.id)}
              onResume={() => handleResume(task.id)}
              onCancel={() => handleCancel(task.id)}
              onRemove={() => handleRemove(task.id)}
              onToggleLogs={() =>
                setExpandedLogId(expandedLogId === task.id ? null : task.id)
              }
              isLogsExpanded={expandedLogId === task.id}
            />
          ))}
        </ScrollView>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: typography.weights.heavy,
    flex: 1,
    textAlign: 'center',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: typography.weights.heavy,
  },
  spacer: {
    width: 60,
  },
  tabsWrapper: {
    height: 48,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabBadge: {
    backgroundColor: colors.elevated,
    borderRadius: radius.round,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeActive: {
    backgroundColor: colors.primary,
  },
  tabBadgeText: {
    fontSize: 8,
    fontWeight: typography.weights.heavy,
    color: colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    gap: 16,
    paddingBottom: 40,
  },
});
export default DownloadManagerScreen;
