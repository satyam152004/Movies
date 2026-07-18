import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {DownloadTask, DownloadStatus} from '../../data/models';
import {colors, radius, spacing, typography} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';

interface DownloadCardProps {
  task: DownloadTask;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onToggleLogs: () => void;
  isLogsExpanded: boolean;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
  task,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onToggleLogs,
  isLogsExpanded,
}) => {
  const getStatusColor = (status: DownloadStatus) => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'paused':
        return colors.warning;
      case 'cancelled':
        return colors.textMuted;
      case 'failed':
        return colors.danger;
      case 'pending':
        return colors.primary;
      default:
        return colors.secondary;
    }
  };

  const getStatusBadgeStyle = (status: DownloadStatus) => {
    switch (status) {
      case 'completed':
        return styles.badgeCompleted;
      case 'paused':
        return styles.badgePaused;
      case 'cancelled':
        return styles.badgeCancelled;
      case 'failed':
        return styles.badgeFailed;
      case 'pending':
        return styles.badgePending;
      default:
        return styles.badgeDownloading;
    }
  };

  return (
    <View style={styles.card}>
      {/* File Details */}
      <View style={styles.fileRow}>
        <Icon name="film-outline" size={24} color={colors.primary} style={{marginRight: 6}} />
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={2}>
            {task.movieTitle}
          </Text>
          <Text style={styles.fileSizeText}>
            Size: <Text style={styles.highlightText}>{task.fileSize}</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteRecordBtn}
          onPress={onRemove}
          activeOpacity={0.7}>
          <Icon name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <Text style={styles.percentText}>{task.progress.toFixed(1)}%</Text>
        <View style={[styles.statusBadge, getStatusBadgeStyle(task.status)]}>
          <Text
            style={[
              styles.statusBadgeText,
              {color: getStatusColor(task.status)},
            ]}>
            {task.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.barContainer}>
        <View
          style={[
            styles.barFiller,
            {
              width: `${task.progress}%`,
              backgroundColor:
                task.status === 'completed' ? colors.success : colors.primary,
            },
          ]}
        />
      </View>

      {/* Metrics Row */}
      {task.status === 'downloading' && (
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>SPEED</Text>
            <Text style={styles.metricValue}>{task.downloadSpeed}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>DOWNLOADED</Text>
            <Text style={styles.metricValue}>{task.downloadedSize}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>ETA</Text>
            <Text style={styles.metricValue}>{task.eta}</Text>
          </View>
        </View>
      )}

      {/* Control Actions Row */}
      <View style={styles.controlsRow}>
        <View style={styles.actionButtons}>
          {task.status === 'downloading' || task.status === 'pending' ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.pauseBtn]}
                onPress={onPause}
                activeOpacity={0.8}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <Icon name="pause" size={14} color={colors.warning} />
                  <Text style={styles.actionBtnText}>Pause</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={onCancel}
                activeOpacity={0.8}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <Icon name="close" size={14} color={colors.danger} />
                  <Text style={styles.actionBtnText}>Cancel</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : task.status === 'paused' ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.resumeBtn]}
                onPress={onResume}
                activeOpacity={0.8}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <Icon name="play" size={14} color={colors.success} />
                  <Text style={styles.actionBtnText}>Resume</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={onCancel}
                activeOpacity={0.8}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <Icon name="close" size={14} color={colors.danger} />
                  <Text style={styles.actionBtnText}>Cancel</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : task.status === 'failed' || task.status === 'cancelled' ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.retryBtn]}
              onPress={onResume}
              activeOpacity={0.8}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Icon name="refresh" size={14} color={colors.primary} />
                <Text style={styles.actionBtnText}>Retry Task</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedPlaceholder}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Icon name="checkmark-done" size={14} color={colors.success} />
                <Text style={styles.completedText}>Saved Successfully</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.toggleLogBtn}
          onPress={onToggleLogs}
          activeOpacity={0.7}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <Icon name={isLogsExpanded ? 'chevron-down' : 'chevron-up'} size={12} color={colors.textSecondary} />
            <Text style={styles.toggleLogBtnText}>LOGS</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Logs Scroll */}
      {isLogsExpanded && (
        <View style={styles.logsBox}>
          <ScrollView nestedScrollEnabled style={styles.logsScroll}>
            {task.logs.map((log, idx) => (
              <Text
                key={idx}
                style={[styles.logRow, {color: colors.textSecondary}]}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
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
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    lineHeight: 18,
  },
  fileSizeText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  highlightText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  deleteRecordBtn: {
    padding: 6,
    borderRadius: radius.sm,
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
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.heavy,
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  badgeDownloading: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  badgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  badgePaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  badgeCancelled: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  badgeFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  badgePending: {
    backgroundColor: 'rgba(144, 97, 249, 0.1)',
  },
  barContainer: {
    height: 8,
    backgroundColor: colors.elevated,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  barFiller: {
    height: '100%',
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: colors.elevated,
    padding: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: typography.weights.heavy,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
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
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: typography.weights.heavy,
  },
  pauseBtn: {
    backgroundColor: colors.warning,
  },
  resumeBtn: {
    backgroundColor: colors.success,
  },
  cancelBtn: {
    backgroundColor: colors.danger,
  },
  retryBtn: {
    backgroundColor: colors.primary,
  },
  completedPlaceholder: {
    justifyContent: 'center',
  },
  completedText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: typography.weights.heavy,
  },
  toggleLogBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  toggleLogBtnText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: typography.weights.heavy,
    letterSpacing: 0.5,
  },
  logsBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    maxHeight: 130,
  },
  logsScroll: {
    maxHeight: 110,
  },
  logRow: {
    fontSize: 9,
    fontFamily: 'monospace',
    lineHeight: 14,
    marginBottom: 3,
  },
});
