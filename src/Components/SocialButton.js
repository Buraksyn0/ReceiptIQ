import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import  Colors  from '../Constants/Colors';

function SocialButton({ iconName, text, iconColor }) {
  return (
    <TouchableOpacity style={styles.socialButton}>
       <Ionicons name={iconName} size={24} color={iconColor} />
       <Text style={styles.socialButtonText}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  socialButtonText: {
    marginLeft: 10,
    fontWeight: '600',
    color: Colors.textMain,
  },
});

export default SocialButton;