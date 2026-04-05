import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/theme';
export default function ProgressCircle({ progress, compact = false }) {
    const fillHeight = useSharedValue(0);
    useEffect(() => {
        fillHeight.value = withTiming(progress, { duration: 900 });
    }, [fillHeight, progress]);
    const circleSize = compact ? 108 : 124;
    const innerSize = compact ? 80 : 94;
    const animatedFillStyle = useAnimatedStyle(() => ({
        height: circleSize * fillHeight.value,
    }));
    return (<View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.circle, { width: circleSize, height: circleSize }]}>
        <Animated.View style={[styles.fill, animatedFillStyle]}/>
        <View style={[styles.innerCircle, { width: innerSize, height: innerSize }]}>
          <Text variant="title" style={compact && styles.percentCompact}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>
      <View style={styles.copyWrap}>
        <Text variant="caption" color="muted" style={styles.kicker}>
          Tong tien do
        </Text>
        <Text variant={compact ? 'subtitle' : 'title'} style={styles.title}>
          Hoan thanh hom nay
        </Text>
        <Text variant="caption" color="muted" style={styles.label}>
          Duy tri 1 thoi quen nua de day EXP trong ngay.
        </Text>
      </View>
    </View>);
}
const styles = StyleSheet.create({
    container: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    containerCompact: {
        gap: spacing.sm,
    },
    circle: {
        borderRadius: radii.pill,
        backgroundColor: colors.primarySoft,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fill: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.primary,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
    },
    innerCircle: {
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyWrap: {
        flex: 1,
        gap: 4,
    },
    kicker: {
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    title: {
        maxWidth: 140,
    },
    label: {
        maxWidth: 160,
        lineHeight: 18,
    },
    percentCompact: {
        fontSize: 22,
        lineHeight: 26,
    },
});

