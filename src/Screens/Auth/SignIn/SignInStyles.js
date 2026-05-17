import { StyleSheet } from 'react-native';
import Colors from '../../../Constants/Colors';
import { s, vs, ms } from '../../../Constants/Responsive';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: s(24),
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: vs(40),
  },
  logoIcon: {
    backgroundColor: 'rgba(41, 121, 255, 0.1)',
    padding: s(12),
    borderRadius: s(16),
    marginBottom: vs(16),
  },
  appName: {
    fontSize: ms(20),
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: vs(8),
    letterSpacing: 1,
  },
  welcomeText: {
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
  formContainer: {
    marginBottom: vs(24),
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginBottom: vs(24),
  },
  forgotText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: ms(14),
  },
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
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
});
