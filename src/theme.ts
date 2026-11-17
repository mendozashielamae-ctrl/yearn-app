import { useColorScheme } from 'react-native';
import { useSettings } from '@/settings/SettingsContext';

export interface Theme {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  tint: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonDanger: string;
  danger: string;
  success: string;
  warning: string;
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  inputBackground: string;
}

const light: Theme = {
  background: '#F7F3E9',
  card: '#FBF8F1',
  text: '#483B37',
  textSecondary: '#9F8D83',
  border: '#E8DED4',
  tint: '#BF8775',
  buttonPrimary: '#BF8775',
  buttonSecondary: '#F0EAE0',
  buttonDanger: '#BA2525',
  danger: '#B42323',
  success: '#2E7D32',
  warning: '#A14800',
  userBubble: '#BF8775',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#EEE9E1',
  inputBackground: '#F0EAE0',
};

const dark: Theme = {
  background: '#252421',
  card: '#302E2A',
  text: '#F1E9DF',
  textSecondary: '#B9A99D',
  border: '#514A43',
  tint: '#D39986',
  buttonPrimary: '#BF8775',
  buttonSecondary: '#3D3934',
  buttonDanger: '#BA2525',
  danger: '#FF8885',
  success: '#66BB6A',
  warning: '#FFA726',
  userBubble: '#835A4D',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#3D3934',
  inputBackground: '#3D3934',
};

export function useTheme(): Theme {
  return useIsDarkTheme() ? dark : light;
}

export function useIsDarkTheme(): boolean {
  const preference = useSettings().settings.theme;
  const systemScheme = useColorScheme();
  return preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
}
