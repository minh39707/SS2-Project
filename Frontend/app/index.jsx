import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '@/src/constants/colors';
import { useOnboarding } from '@/src/store/OnboardingContext';
export default function IndexScreen() {
    const { completed, hydrated, onboardingCompleted } = useOnboarding();
    if (!hydrated) {
        return (<View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large"/>
      </View>);
    }
    if (completed) {
        return <Redirect href="/(tabs)"/>;
    }
    if (onboardingCompleted) {
        return <Redirect href={{ pathname: '/sign-in', params: { source: 'onboarding' } }}/>;
    }
    return <Redirect href="/welcome"/>;
}
const styles = StyleSheet.create({
    loader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
});

