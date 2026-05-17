import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../Constants/Colors';

/**
 * CustomInput
 *
 * Şifre kullanımı:
 *   <CustomInput isPassword secureTextEntry={!visible} onTogglePassword={...}
 *                textContentType="newPassword" />  // SignUp
 *   <CustomInput isPassword secureTextEntry={!visible} onTogglePassword={...}
 *                textContentType="password" />     // SignIn
 *
 * iOS Strong Password önerisini engellemek için isPassword olduğunda
 * autoCorrect=false ve uygun textContentType gönderiyoruz.
 */
function CustomInput({
  icon,
  placeholder,
  isPassword,
  secureTextEntry,
  onTogglePassword,
  textContentType,
  passwordRules,
  ...props
}) {
  // Şifre alanı default davranışları
  const passwordProps = isPassword
    ? {
        autoCorrect: false,
        autoCapitalize: 'none',
        spellCheck: false,
        textContentType: textContentType || 'password',
        // iOS'un strong password rule önerisini sade tut
        passwordRules:
          passwordRules ||
          'minlength: 6; required: lower; required: upper; required: digit;',
      }
    : {};

  return (
    <View style={styles.inputWrapper}>
      <Ionicons
        name={icon}
        size={20}
        color={Colors.textSecondary}
        style={styles.inputIcon}
      />

      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.placeholder}
        secureTextEntry={secureTextEntry}
        {...passwordProps}
        {...props}
      />

      {isPassword && (
        <TouchableOpacity onPress={onTogglePassword}>
          <Ionicons
            name={secureTextEntry ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={Colors.placeholder}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: Colors.textMain },
});

export default CustomInput;
