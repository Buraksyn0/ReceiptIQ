import { StyleSheet } from 'react-native';
import Colors from '../../../Constants/Colors';
import { s, vs, ms } from '../../../Constants/Responsive';

export default StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: s(24),
    justifyContent: 'center',
    paddingVertical: vs(20),
  },

  // Header
  headerContainer: {
    alignItems: 'center',
    marginBottom: vs(30),
  },
  logoIcon: {
    backgroundColor: 'rgba(41, 121, 255, 0.1)',
    padding: s(12),
    borderRadius: s(16),
    marginBottom: vs(16),
  },
  title: {
    fontSize: ms(32),
    fontWeight: 'bold',
    color: Colors.textMain,
    marginBottom: vs(8),
  },
  subText: {
    fontSize: ms(15),
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Form
  formContainer: {
    marginBottom: vs(24),
  },

  // Footer
  footerContainer: {
    marginTop: vs(10),
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(24),
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E1E8ED',
  },
  dividerText: {
    marginHorizontal: s(16),
    color: Colors.placeholder,
    fontWeight: '600',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: vs(24),
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: vs(20),
  },
  loginText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
});
