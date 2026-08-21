import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {movieTheme} from './theme';
import {typography} from '../../theme';
import {DownloadLink, MovieDetail} from '../../data/models';
import {formatDisplayTitle} from '../../utils/formatDisplayTitle';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

interface MovieDownloadsProps {
  visible: boolean;
  onClose: () => void;
  movie: MovieDetail;
  isAnyResolving: boolean;
  resolvingUrl: string | null;
  resolvingMirrorUrl: string | null;
  resolvingFinalUrl: string | null;
  resolvingServerUrl: string | null;
  handleLinkPress: (link: DownloadLink) => void;
  error?: string | null;
  onRetry?: () => void;
  onClearError?: () => void;
}

export function parseLinkLabel(label: string): string[] {
  if (!label) {
    return [];
  }
  const tags: string[] = [];
  const lower = label.toLowerCase();

  // 1. Source / Rip Type
  if (lower.includes('bluray')) {
    tags.push('BluRay');
  } else if (lower.includes('web-dl') || lower.includes('webdl')) {
    tags.push('WEB-DL');
  } else if (lower.includes('hdrip')) {
    tags.push('HDRip');
  } else if (lower.includes('hdtc') || lower.includes('tc')) {
    tags.push('HDTC');
  } else if (lower.includes('cam')) {
    tags.push('CAM');
  }

  // 2. Codec and Color
  if (lower.includes('hevc') || lower.includes('x265')) {
    tags.push('HEVC');
  } else if (lower.includes('x264')) {
    tags.push('x264');
  }
  if (lower.includes('10bit') || lower.includes('10-bit')) {
    tags.push('10-Bit');
  }

  // 3. Audio & Language
  if (lower.includes('dual')) {
    tags.push('Dual Audio');
  } else if (lower.includes('multi')) {
    tags.push('Multi Audio');
  } else if (lower.includes('hindi')) {
    tags.push('Hindi');
  } else if (lower.includes('english')) {
    tags.push('English');
  }

  if (lower.includes('line')) {
    tags.push('LINE Audio');
  }

  return tags;
}

export const MovieDownloads: React.FC<MovieDownloadsProps> = ({
  visible,
  onClose,
  movie,
  isAnyResolving,
  resolvingUrl: _resolvingUrl,
  resolvingMirrorUrl,
  resolvingFinalUrl,
  resolvingServerUrl,
  handleLinkPress,
  error,
  onRetry,
  onClearError,
}) => {
  const [selectedLink, setSelectedLink] = useState<DownloadLink | null>(null);
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Filter links to only show unique resolutions/labels and exclude watch links
  const downloadLinks = (movie.downloadLinks || []).filter(
    link => link.type === 'download',
  );

  const sampleLinks = React.useMemo(
    () =>
      downloadLinks.filter(
        link =>
          link.label?.toLowerCase().includes('sample') ||
          link.resolution?.toLowerCase().includes('sample'),
      ),
    [downloadLinks],
  );

  const qualityLinks = React.useMemo(
    () =>
      downloadLinks.filter(
        link =>
          !link.label?.toLowerCase().includes('sample') &&
          !link.resolution?.toLowerCase().includes('sample'),
      ),
    [downloadLinks],
  );

  useEffect(() => {
    if (visible) {
      // Select first standard option by default if available, otherwise sample
      if (!selectedLink) {
        if (qualityLinks.length > 0) {
          setSelectedLink(qualityLinks[0]);
        } else if (sampleLinks.length > 0) {
          setSelectedLink(sampleLinks[0]);
        }
      }
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 45,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, qualityLinks, sampleLinks, selectedLink, slideAnim]);

  if (!visible) {
    return null;
  }

  const handleConfirmDownload = () => {
    if (selectedLink) {
      handleLinkPress(selectedLink);
    }
  };

  const getProgressStep = () => {
    if (resolvingServerUrl) {
      return 2;
    }
    if (resolvingFinalUrl || resolvingMirrorUrl) {
      return 1;
    }
    return 0;
  };

  const currentStep = getProgressStep();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <TouchableWithoutFeedback
          onPress={isAnyResolving ? undefined : onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheetContainer,
            {transform: [{translateY: slideAnim}]},
          ]}>
          {!isAnyResolving && <View style={styles.dragIndicator} />}

          {isAnyResolving ? (
            /* PREPARING DOWNLOAD VIEW */
            <View style={styles.preparingContainer}>
              <Text style={styles.preparingTitle}>Preparing download...</Text>
              <Text style={styles.movieTitleText}>
                {formatDisplayTitle(movie.title)}
              </Text>
              {selectedLink && (
                <Text style={styles.movieSubText}>
                  {selectedLink.resolution || 'HD'} •{' '}
                  {selectedLink.size || 'Unknown Size'}
                </Text>
              )}

              {/* Steps Loader */}
              <View style={styles.stepperContainer}>
                <View style={styles.stepRow}>
                  <View style={styles.iconCircle}>
                    {currentStep > 0 ? (
                      <Icon
                        name="checkmark-circle"
                        size={22}
                        color={movieTheme.colors.success}
                      />
                    ) : (
                      <ActivityIndicator
                        size="small"
                        color={movieTheme.colors.primary}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      currentStep === 0 && styles.activeStepText,
                      currentStep > 0 && styles.completedStepText,
                    ]}>
                    Preparing source
                  </Text>
                </View>

                <View
                  style={[
                    styles.stepLine,
                    currentStep > 0 && styles.stepLineActive,
                  ]}
                />

                <View style={styles.stepRow}>
                  <View style={styles.iconCircle}>
                    {currentStep > 1 ? (
                      <Icon
                        name="checkmark-circle"
                        size={22}
                        color={movieTheme.colors.success}
                      />
                    ) : currentStep === 1 ? (
                      <ActivityIndicator
                        size="small"
                        color={movieTheme.colors.primary}
                      />
                    ) : (
                      <Icon
                        name="ellipse-outline"
                        size={20}
                        color={movieTheme.colors.secondary}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      currentStep === 1 && styles.activeStepText,
                      currentStep > 1 && styles.completedStepText,
                    ]}>
                    Starting download
                  </Text>
                </View>

                <View
                  style={[
                    styles.stepLine,
                    currentStep > 1 && styles.stepLineActive,
                  ]}
                />

                <View style={styles.stepRow}>
                  <View style={styles.iconCircle}>
                    {currentStep === 2 ? (
                      <ActivityIndicator
                        size="small"
                        color={movieTheme.colors.primary}
                      />
                    ) : (
                      <Icon
                        name="ellipse-outline"
                        size={20}
                        color={movieTheme.colors.secondary}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      currentStep === 2 && styles.activeStepText,
                    ]}>
                    Downloading
                  </Text>
                </View>
              </View>

              <Text style={styles.pleaseWaitText}>
                Preparing your download…
              </Text>
            </View>
          ) : (
            /* QUALITY SELECTION VIEW */
            <View style={styles.contentContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Download Options</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Icon name="close" size={22} color={movieTheme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.movieHeader}>
                <Text style={styles.movieName} numberOfLines={1}>
                  {formatDisplayTitle(movie.title)}
                </Text>
                <Text style={styles.movieMeta}>
                  {movie.date || '2026'} • {movie.language || 'Multi-Audio'}
                </Text>
              </View>

              {/* Error Banner section if resolution fails */}
              {error && (
                <View style={styles.errorContainer}>
                  <View style={styles.errorHeader}>
                    <View style={styles.errorTitleRow}>
                      <Icon
                        name="alert-circle"
                        size={18}
                        color={movieTheme.colors.danger}
                      />
                      <Text style={styles.errorTitle}>
                        Download unavailable
                      </Text>
                    </View>
                    {onClearError && (
                      <TouchableOpacity
                        onPress={onClearError}
                        style={styles.errorCloseBtn}>
                        <Icon
                          name="close"
                          size={18}
                          color={movieTheme.colors.secondary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.errorMessage}>{error}</Text>
                  {onRetry && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Sample / Preview section */}
              {sampleLinks.length > 0 && (
                <View style={styles.sampleSection}>
                  <Text style={styles.labelTitle}>Preview / Sample</Text>
                  {sampleLinks.map((link, idx) => {
                    const isSelected = selectedLink?.url === link.url;
                    return (
                      <TouchableOpacity
                        key={`sample-${idx}`}
                        style={[
                          styles.optionCard,
                          styles.sampleCard,
                          isSelected && styles.optionCardSelected,
                        ]}
                        onPress={() => setSelectedLink(link)}
                        activeOpacity={0.8}>
                        <View style={styles.radioWrapper}>
                          <Icon
                            name={
                              isSelected
                                ? 'radio-button-on'
                                : 'radio-button-off'
                            }
                            size={20}
                            color={
                              isSelected
                                ? movieTheme.colors.primary
                                : 'rgba(255, 255, 255, 0.2)'
                            }
                          />
                        </View>
                        <View style={styles.optionDetails}>
                          <Text style={styles.optionResolution}>
                            ↓ Download Sample Video
                          </Text>
                          <Text style={styles.optionSubText}>
                            {link.size
                              ? `${link.size} • Test download quality`
                              : 'Test download quality'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Quality options section */}
              <Text style={styles.labelTitle}>Video Quality</Text>
              {qualityLinks.length === 0 ? (
                <Text style={styles.noLinksText}>
                  No video qualities available for this title.
                </Text>
              ) : (
                <View style={styles.optionsList}>
                  {qualityLinks.map((link, idx) => {
                    const isSelected = selectedLink?.url === link.url;

                    // Parse real label metadata without inventing any new details
                    const tags = parseLinkLabel(link.label);
                    const extraInfo =
                      tags.length > 0 ? ` • ${tags.join(' • ')}` : '';

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.optionCard,
                          isSelected && styles.optionCardSelected,
                        ]}
                        onPress={() => setSelectedLink(link)}
                        activeOpacity={0.8}>
                        <View style={styles.radioWrapper}>
                          <Icon
                            name={
                              isSelected
                                ? 'radio-button-on'
                                : 'radio-button-off'
                            }
                            size={20}
                            color={
                              isSelected
                                ? movieTheme.colors.primary
                                : 'rgba(255, 255, 255, 0.2)'
                            }
                          />
                        </View>
                        <View style={styles.optionDetails}>
                          <View style={styles.optionTitleRow}>
                            <Text style={styles.optionResolution}>
                              {link.resolution || 'Standard Resolution'}
                            </Text>
                          </View>
                          <Text style={styles.optionSubText}>
                            {link.size
                              ? `${link.size}${extraInfo}`
                              : `High Speed Download${extraInfo}`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {selectedLink && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Download Size</Text>
                  <Text style={styles.summaryValue}>
                    {selectedLink.size || 'Unknown Size'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.downloadBtn,
                  !selectedLink && styles.downloadBtnDisabled,
                ]}
                disabled={!selectedLink}
                onPress={handleConfirmDownload}
                activeOpacity={0.8}>
                {isAnyResolving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon
                      name="arrow-down-outline"
                      size={20}
                      color="#FFFFFF"
                      style={{marginRight: 6}}
                    />
                    <Text style={styles.downloadBtnText}>Start Download</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  sheetContainer: {
    backgroundColor: '#101217',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#272C38',
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  contentContainer: {
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    ...typography.tokens.h3,

    
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  movieHeader: {
    marginBottom: 20,
  },
  movieName: {
    ...typography.tokens.bodyMedium,

    
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.text,
    marginBottom: 4,
  },
  movieMeta: {
    ...typography.tokens.caption,

    
    color: movieTheme.colors.secondary,
  },
  labelTitle: {
    ...typography.tokens.caption,
    fontSize: 11,

    
    fontWeight: movieTheme.typography.weights.bold,
    color: '#70798A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sampleSection: {
    marginBottom: 16,
  },
  sampleCard: {
    backgroundColor: '#13151D',
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  optionsList: {
    gap: 10,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161922',
    borderWidth: 1.5,
    borderColor: '#272C38',
    borderRadius: movieTheme.radius.card,
    padding: 14,
  },
  optionCardSelected: {
    borderColor: movieTheme.colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
  },
  radioWrapper: {
    marginRight: 14,
  },
  optionDetails: {
    flex: 1,
    gap: 2,
  },
  optionResolution: {
    ...typography.tokens.button,

    
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.text,
  },
  optionSubText: {
    ...typography.tokens.caption,
    fontSize: 11,

    
    color: movieTheme.colors.secondary,
  },
  noLinksText: {
    color: movieTheme.colors.secondary,
    textAlign: 'center',
    marginVertical: 20,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  recBadge: {
    backgroundColor: 'rgba(144, 97, 249, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(144, 97, 249, 0.25)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  recBadgeText: {
    color: movieTheme.colors.primary,
    ...typography.tokens.label,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 20,
  },
  summaryLabel: {
    ...typography.tokens.secondary,

    
    color: movieTheme.colors.secondary,
  },
  summaryValue: {
    ...typography.tokens.body,

    
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.primary,
  },
  downloadBtn: {
    height: 48,
    backgroundColor: movieTheme.colors.primary,
    borderRadius: movieTheme.radius.cardControl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnDisabled: {
    opacity: 0.5,
  },
  downloadBtnText: {
    ...typography.tokens.button,

    color: '#FFFFFF',
    
    fontWeight: movieTheme.typography.weights.bold,
  },
  /* PREPARING STATE STYLES */
  preparingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  preparingTitle: {
    ...typography.tokens.h3,

    
    fontWeight: movieTheme.typography.weights.bold,
    color: movieTheme.colors.text,
    marginBottom: 8,
  },
  movieTitleText: {
    ...typography.tokens.body,

    
    fontWeight: movieTheme.typography.weights.medium,
    color: movieTheme.colors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  movieSubText: {
    ...typography.tokens.caption,

    
    color: movieTheme.colors.secondary,
    marginBottom: 26,
  },
  stepperContainer: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 4,
    marginBottom: 26,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    ...typography.tokens.secondary,

    
    color: movieTheme.colors.secondary,
  },
  activeStepText: {
    color: movieTheme.colors.text,
    fontWeight: movieTheme.typography.weights.bold,
  },
  completedStepText: {
    color: movieTheme.colors.success,
  },
  stepLine: {
    width: 2,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 11,
  },
  stepLineActive: {
    backgroundColor: movieTheme.colors.success,
  },
  pleaseWaitText: {
    ...typography.tokens.caption,
    fontSize: 11,

    
    color: '#70798A',
  },
  /* ERROR STYLES */
  errorContainer: {
    backgroundColor: '#1A0E10',
    borderWidth: 1.5,
    borderColor: '#4A1D24',
    borderRadius: movieTheme.radius.card,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorTitle: {
    ...typography.tokens.button,

    color: '#FC8181',
    
    fontWeight: '700',
  },
  errorCloseBtn: {
    padding: 2,
  },
  errorMessage: {
    ...typography.tokens.caption,

    color: '#E5E7EB',
    
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: '#E53E3E',
    borderRadius: movieTheme.radius.compactControl,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  retryText: {
    ...typography.tokens.caption,

    color: '#FFFFFF',
    
    fontWeight: '700',
  },
});
