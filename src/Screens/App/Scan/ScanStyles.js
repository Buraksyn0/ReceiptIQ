import { StyleSheet } from 'react-native';
import Colors from '../../../Constants/Colors';
import { s, vs, ms } from '../../../Constants/Responsive';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: s(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41, 121, 255, 0.1)',
  },
  instructionText: {
    color: '#fff',
    marginTop: vs(20),
    fontSize: ms(14),
    fontWeight: '500',
    opacity: 0.8,
  },
  controlsContainer: {
    height: vs(180),
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: s(30),
    paddingBottom: vs(90),
  },
  smallButton: {
    width: s(50),
    height: s(50),
    borderRadius: s(25),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonOuter: {
    width: s(80),
    height: s(80),
    borderRadius: s(40),
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    backgroundColor: Colors.primary,
  },
});
