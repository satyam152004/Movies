import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {DownloadStatus} from '../../data/models';
import {colors, radius, typography} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';

interface DownloadTaskWithDetails {
  id: string;
  movieTitle: string;
  fileSize: string;
  downloadUrl: string;
  progress: number;
  status: DownloadStatus;
  downloadSpeed: string;
  downloadedSize: string;
  eta: string;
  logs: string[];
  imageUrl?: string;
  resolution: string;
}

interface DownloadCardProps {
  task: DownloadTaskWithDetails;
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
  const [showMenu, setShowMenu] = useState(false);

  const getStatusLabel = () => {
    switch (task.status) {
      case 'completed':
        return 'Completed';
      case 'paused':
        return 'Paused';
      case 'cancelled':
        return 'Cancelled';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Queued';
      case 'downloading':
        return 'Downloading';
      default:
        return 'Pending';
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return colors.success;
      case 'paused':
        return colors.warning;
      case 'failed':
      case 'cancelled':
        return colors.danger;
      case 'pending':
        return colors.secondary;
      default:
        return colors.primary;
    }
  };

  const statusColor = getStatusColor();

  return (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        {/* Poster image (2:3 aspect ratio) */}
        <View style={styles.posterWrapper}>
          {task.imageUrl ? (
            <Image
              source={{uri: task.imageUrl}}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Icon name="film-outline" size={24} color={colors.textMuted} />
            </View>
          )}
        </View>

        {/* Title, Details, Actions */}
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <Text
              style={styles.movieTitle}
              numberOfLines={1}
              ellipsizeMode="tail">
              {task.movieTitle}
            </Text>
            <View style={styles.statusAndMenuRow}>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}1A` }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                  {getStatusLabel()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowMenu(!showMenu)}
                activeOpacity={0.7}
                style={styles.moreBtn}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityLabel="More options"
                accessibilityRole="button">
                <Icon
                  name="ellipsis-vertical"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.metaText}>
            {task.resolution} • {task.fileSize}
          </Text>

          {/* Render state-specific details */}
          <View style={styles.progressAndButtonsRow}>
            <View style={styles.progressColumn}>
              {task.status === 'downloading' && (
                <>
                  <Text style={[styles.percentText, { color: colors.primary }]}>
                    {Math.floor(task.progress)}%
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${task.progress}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {task.downloadedSize} / {task.fileSize} • {task.eta || 'calculating...'}
                  </Text>
                </>
              )}

              {task.status === 'paused' && (
                <>
                  <Text style={[styles.percentText, { color: colors.warning }]}>
                    {Math.floor(task.progress)}% (Paused)
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${task.progress}%`,
                          backgroundColor: colors.warning,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {task.downloadedSize} / {task.fileSize}
                  </Text>
                </>
              )}

              {task.status === 'pending' && (
                <>
                  <Text style={[styles.percentText, { color: colors.secondary }]}>
                    Queued...
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: '0%',
                          backgroundColor: colors.secondary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>Preparing download</Text>
                </>
              )}

              {task.status === 'completed' && (
                <View style={styles.completedStatusWrapper}>
                  <Icon name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.completedStatusText}>Downloaded successfully</Text>
                </View>
              )}

              {(task.status === 'failed' || task.status === 'cancelled') && (
                <View style={styles.completedStatusWrapper}>
                  <Icon name="alert-circle" size={16} color={colors.danger} />
                  <Text style={[styles.completedStatusText, { color: colors.danger }]}>
                    Download {task.status}
                  </Text>
                </View>
              )}
            </View>

            {/* Circular buttons aligned horizontally on the right side */}
            <View style={styles.actionButtons}>
              {task.status === 'downloading' && (
                <>
                  <TouchableOpacity
                    onPress={onPause}
                    style={[styles.circleButton, { borderColor: `${colors.primary}40` }]}
                    accessibilityLabel="Pause download"
                    accessibilityRole="button">
                    <Icon name="pause" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onCancel}
                    style={[styles.circleButton, { borderColor: `${colors.primary}40` }]}
                    accessibilityLabel="Cancel download"
                    accessibilityRole="button">
                    <Icon name="close" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </>
              )}

              {task.status === 'paused' && (
                <>
                  <TouchableOpacity
                    onPress={onResume}
                    style={[styles.circleButton, { borderColor: `${colors.warning}40` }]}
                    accessibilityLabel="Resume download"
                    accessibilityRole="button">
                    <Icon name="play" size={16} color={colors.warning} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onCancel}
                    style={[styles.circleButton, { borderColor: `${colors.warning}40` }]}
                    accessibilityLabel="Cancel download"
                    accessibilityRole="button">
                    <Icon name="close" size={16} color={colors.warning} />
                  </TouchableOpacity>
                </>
              )}

              {task.status === 'pending' && (
                <TouchableOpacity
                  onPress={onCancel}
                  style={[styles.circleButton, { borderColor: `${colors.secondary}40` }]}
                  accessibilityLabel="Cancel download"
                  accessibilityRole="button">
                  <Icon name="close" size={16} color={colors.secondary} />
                </TouchableOpacity>
              )}

              {task.status === 'completed' && (
                <>
                  <TouchableOpacity
                    style={[styles.circleButton, { borderColor: `${colors.success}40` }]}
                    accessibilityLabel="Play download"
                    accessibilityRole="button">
                    <Icon name="play" size={16} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onRemove}
                    style={[styles.circleButton, { borderColor: `${colors.danger}40` }]}
                    accessibilityLabel="Delete download"
                    accessibilityRole="button">
                    <Icon name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </>
              )}

              {(task.status === 'failed' || task.status === 'cancelled') && (
                <>
                  <TouchableOpacity
                    onPress={onResume}
                    style={[styles.circleButton, { borderColor: `${colors.primary}40` }]}
                    accessibilityLabel="Retry download"
                    accessibilityRole="button">
                    <Icon name="refresh" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onRemove}
                    style={[styles.circleButton, { borderColor: `${colors.danger}40` }]}
                    accessibilityLabel="Delete download"
                    accessibilityRole="button">
                    <Icon name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Overflow Menu Modal Overlay */}
      {showMenu && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity
            onPress={() => {
              setShowMenu(false);
              onRemove();
            }}
            style={styles.menuItem}
            accessibilityLabel="Delete download"
            accessibilityRole="button">
            <Icon name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.menuItemText, {color: colors.danger}]}>
              Delete Download
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowMenu(false)}
            style={styles.menuItemClose}
            accessibilityLabel="Cancel menu"
            accessibilityRole="button">
            <Text style={styles.menuItemCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Collapsible Scraper Logs */}
      {isLogsExpanded && (
        <View style={styles.logsBox}>
          <Text style={styles.logsTitle}>Scraper Debug Logs</Text>
          <ScrollView nestedScrollEnabled style={styles.logsScroll}>
            {task.logs.map((log, idx) => (
              <Text key={idx} style={styles.logRow}>
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
    backgroundColor: '#121214',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    position: 'relative',
  },
  cardMain: {
    flexDirection: 'row',
    gap: 12,
  },
  posterWrapper: {
    width: 76,
    height: 114,
    borderRadius: radius.compactControl,
    backgroundColor: '#101014',
    overflow: 'hidden',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: typography.weights.bold,
    flex: 1,
    marginRight: 8,
  },
  statusAndMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  moreBtn: {
    padding: 4,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  progressAndButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressColumn: {
    flex: 1,
    marginRight: 12,
  },
  percentText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: '#1E1E24',
    borderRadius: 2.5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  progressText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  completedStatusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  completedStatusText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 0,
    zIndex: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: typography.weights.bold,
  },
  menuItemClose: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuItemCloseText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: typography.weights.bold,
  },
  logsBox: {
    marginTop: 10,
    backgroundColor: colors.background,
    borderRadius: radius.compactControl,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logsTitle: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  logsScroll: {
    maxHeight: 90,
  },
  logRow: {
    fontSize: 9,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 14,
    marginBottom: 2,
  },
});
