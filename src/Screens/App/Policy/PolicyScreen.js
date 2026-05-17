import React, { useMemo } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../Context/ThemeContext';
import { useLanguage } from '../../../Context/LanguageContext';
import { s, vs, ms } from '../../../Constants/Responsive';

const PRIVACY_CONTENT = {
  tr: {
    title: 'Gizlilik Politikası',
    lastUpdated: 'Son güncelleme: Mayıs 2026',
    sections: [
      {
        heading: '1. Toplanan Veriler',
        body: 'ReceiptIQ; ad, e-posta adresi, şehir bilgisi ve fiş/harcama verilerini toplar. Bu veriler yalnızca uygulamanın işlevselliği için kullanılır.',
      },
      {
        heading: '2. Verilerin Kullanımı',
        body: 'Toplanan veriler; harcama analizleri sunmak, bütçe takibi yapmak ve kullanıcı deneyimini kişiselleştirmek amacıyla kullanılır. Verileriniz üçüncü taraflarla paylaşılmaz veya satılmaz.',
      },
      {
        heading: '3. Veri Güvenliği',
        body: 'Verileriniz şifrelenmiş bağlantılar (HTTPS) üzerinden iletilir ve güvenli sunucularda saklanır. Şifreler hiçbir zaman düz metin olarak tutulmaz.',
      },
      {
        heading: '4. Veri Saklama',
        body: 'Hesabınızı sildiğinizde tüm kişisel verileriniz ve fişleriniz kalıcı olarak silinir. Bu işlem geri alınamaz.',
      },
      {
        heading: '5. KVKK Hakları',
        body: 'Kişisel Verilerin Korunması Kanunu kapsamında verilerinize erişme, düzeltme ve silme hakkına sahipsiniz. Talepleriniz için uygulama üzerinden bizimle iletişime geçebilirsiniz.',
      },
      {
        heading: '6. İletişim',
        body: 'Gizlilik politikamıza ilişkin sorularınız için: support@receiptiq.app',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: May 2026',
    sections: [
      {
        heading: '1. Data We Collect',
        body: 'ReceiptIQ collects your name, email address, city, and receipt/spending data. This information is used solely to provide app functionality.',
      },
      {
        heading: '2. How We Use Your Data',
        body: 'Collected data is used to provide spending analytics, budget tracking, and personalized experiences. Your data is never shared with or sold to third parties.',
      },
      {
        heading: '3. Data Security',
        body: 'Your data is transmitted over encrypted connections (HTTPS) and stored on secure servers. Passwords are never stored in plain text.',
      },
      {
        heading: '4. Data Retention',
        body: 'When you delete your account, all your personal data and receipts are permanently deleted. This action cannot be undone.',
      },
      {
        heading: '5. Your Rights',
        body: 'You have the right to access, correct, and delete your personal data. Contact us through the app for any requests.',
      },
      {
        heading: '6. Contact',
        body: 'For questions about our privacy policy: support@receiptiq.app',
      },
    ],
  },
  de: {
    title: 'Datenschutzrichtlinie',
    lastUpdated: 'Zuletzt aktualisiert: Mai 2026',
    sections: [
      {
        heading: '1. Erhobene Daten',
        body: 'ReceiptIQ erfasst Ihren Namen, Ihre E-Mail-Adresse, Ihren Wohnort sowie Beleg- und Ausgabendaten. Diese Informationen werden ausschließlich zur Bereitstellung der App-Funktionalität verwendet.',
      },
      {
        heading: '2. Datenverwendung',
        body: 'Die erhobenen Daten werden zur Ausgabenanalyse, Budgetverfolgung und Personalisierung verwendet. Ihre Daten werden nicht an Dritte weitergegeben oder verkauft.',
      },
      {
        heading: '3. Datensicherheit',
        body: 'Ihre Daten werden über verschlüsselte Verbindungen (HTTPS) übertragen und auf sicheren Servern gespeichert. Passwörter werden niemals im Klartext gespeichert.',
      },
      {
        heading: '4. Datenspeicherung',
        body: 'Wenn Sie Ihr Konto löschen, werden alle Ihre persönlichen Daten und Belege dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
      },
      {
        heading: '5. Ihre Rechte',
        body: 'Sie haben das Recht, auf Ihre persönlichen Daten zuzugreifen, diese zu korrigieren und zu löschen. Kontaktieren Sie uns über die App.',
      },
      {
        heading: '6. Kontakt',
        body: 'Bei Fragen zu unserer Datenschutzrichtlinie: support@receiptiq.app',
      },
    ],
  },
  fr: {
    title: 'Politique de confidentialité',
    lastUpdated: 'Dernière mise à jour : mai 2026',
    sections: [
      {
        heading: '1. Données collectées',
        body: 'ReceiptIQ collecte votre nom, adresse e-mail, ville et données de reçus/dépenses. Ces informations sont utilisées uniquement pour fournir les fonctionnalités de l\'application.',
      },
      {
        heading: '2. Utilisation des données',
        body: 'Les données collectées sont utilisées pour fournir des analyses de dépenses, un suivi budgétaire et des expériences personnalisées. Vos données ne sont jamais partagées ni vendues à des tiers.',
      },
      {
        heading: '3. Sécurité des données',
        body: 'Vos données sont transmises via des connexions chiffrées (HTTPS) et stockées sur des serveurs sécurisés. Les mots de passe ne sont jamais stockés en texte clair.',
      },
      {
        heading: '4. Conservation des données',
        body: 'Lorsque vous supprimez votre compte, toutes vos données personnelles et reçus sont définitivement supprimés. Cette action est irréversible.',
      },
      {
        heading: '5. Vos droits',
        body: 'Vous avez le droit d\'accéder, de corriger et de supprimer vos données personnelles. Contactez-nous via l\'application.',
      },
      {
        heading: '6. Contact',
        body: 'Pour toute question sur notre politique de confidentialité : support@receiptiq.app',
      },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    lastUpdated: 'Последнее обновление: май 2026',
    sections: [
      {
        heading: '1. Собираемые данные',
        body: 'ReceiptIQ собирает ваше имя, адрес электронной почты, город и данные о чеках/расходах. Эта информация используется исключительно для обеспечения функциональности приложения.',
      },
      {
        heading: '2. Использование данных',
        body: 'Собранные данные используются для анализа расходов, отслеживания бюджета и персонализации. Ваши данные никогда не передаются третьим лицам и не продаются.',
      },
      {
        heading: '3. Безопасность данных',
        body: 'Ваши данные передаются по зашифрованным соединениям (HTTPS) и хранятся на защищённых серверах. Пароли никогда не хранятся в открытом виде.',
      },
      {
        heading: '4. Хранение данных',
        body: 'При удалении аккаунта все ваши личные данные и чеки удаляются навсегда. Это действие необратимо.',
      },
      {
        heading: '5. Ваши права',
        body: 'Вы имеете право на доступ, исправление и удаление своих персональных данных. Свяжитесь с нами через приложение.',
      },
      {
        heading: '6. Контакты',
        body: 'По вопросам политики конфиденциальности: support@receiptiq.app',
      },
    ],
  },
};

const TERMS_CONTENT = {
  tr: {
    title: 'Kullanım Koşulları',
    lastUpdated: 'Son güncelleme: Mayıs 2026',
    sections: [
      {
        heading: '1. Hizmetin Kapsamı',
        body: 'ReceiptIQ, kişisel harcamalarınızı takip etmenize ve bütçenizi yönetmenize yardımcı olan bir mobil uygulamadır. Uygulama yalnızca kişisel kullanım amacıyla sunulmaktadır.',
      },
      {
        heading: '2. Hesap Sorumluluğu',
        body: 'Hesabınızın güvenliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmayın. Hesabınızda gerçekleşen tüm işlemlerden siz sorumlu tutulursunuz.',
      },
      {
        heading: '3. Kabul Edilemez Kullanım',
        body: 'Uygulamayı yasadışı amaçlarla, başkalarına zarar verecek şekilde veya sistemin bütünlüğünü bozacak biçimde kullanamazsınız.',
      },
      {
        heading: '4. Hizmet Değişiklikleri',
        body: 'ReceiptIQ, önceden bildirimde bulunarak veya bulunmaksızın uygulama özelliklerini değiştirme ya da sonlandırma hakkını saklı tutar.',
      },
      {
        heading: '5. Sorumluluk Sınırı',
        body: 'ReceiptIQ, uygulama kullanımından doğabilecek dolaylı zararlardan sorumlu tutulamaz. Finansal kararlarınız için lütfen profesyonel danışmanlık alın.',
      },
      {
        heading: '6. İletişim',
        body: 'Kullanım koşullarına ilişkin sorularınız için: support@receiptiq.app',
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    lastUpdated: 'Last updated: May 2026',
    sections: [
      {
        heading: '1. Scope of Service',
        body: 'ReceiptIQ is a mobile application that helps you track personal expenses and manage your budget. The app is provided for personal use only.',
      },
      {
        heading: '2. Account Responsibility',
        body: 'You are responsible for the security of your account. Do not share your password with anyone. You are responsible for all activity that occurs under your account.',
      },
      {
        heading: '3. Prohibited Use',
        body: 'You may not use the app for illegal purposes, in ways that harm others, or in ways that compromise the integrity of the system.',
      },
      {
        heading: '4. Service Changes',
        body: 'ReceiptIQ reserves the right to modify or discontinue app features with or without notice.',
      },
      {
        heading: '5. Limitation of Liability',
        body: 'ReceiptIQ cannot be held liable for indirect damages arising from the use of the app. Please seek professional advice for financial decisions.',
      },
      {
        heading: '6. Contact',
        body: 'For questions about our terms of service: support@receiptiq.app',
      },
    ],
  },
  de: {
    title: 'Nutzungsbedingungen',
    lastUpdated: 'Zuletzt aktualisiert: Mai 2026',
    sections: [
      {
        heading: '1. Leistungsumfang',
        body: 'ReceiptIQ ist eine mobile Anwendung, die Ihnen hilft, persönliche Ausgaben zu verfolgen und Ihr Budget zu verwalten. Die App wird ausschließlich für den persönlichen Gebrauch bereitgestellt.',
      },
      {
        heading: '2. Kontoverantwortung',
        body: 'Sie sind für die Sicherheit Ihres Kontos verantwortlich. Teilen Sie Ihr Passwort mit niemandem. Sie sind für alle Aktivitäten verantwortlich, die unter Ihrem Konto stattfinden.',
      },
      {
        heading: '3. Unzulässige Nutzung',
        body: 'Sie dürfen die App nicht für illegale Zwecke, auf eine Weise, die anderen schadet, oder auf eine Weise nutzen, die die Integrität des Systems gefährdet.',
      },
      {
        heading: '4. Änderungen des Dienstes',
        body: 'ReceiptIQ behält sich das Recht vor, App-Funktionen mit oder ohne Vorankündigung zu ändern oder einzustellen.',
      },
      {
        heading: '5. Haftungsbeschränkung',
        body: 'ReceiptIQ haftet nicht für indirekte Schäden, die aus der Nutzung der App entstehen. Bitte holen Sie professionellen Rat für finanzielle Entscheidungen ein.',
      },
      {
        heading: '6. Kontakt',
        body: 'Bei Fragen zu unseren Nutzungsbedingungen: support@receiptiq.app',
      },
    ],
  },
  fr: {
    title: 'Conditions d\'utilisation',
    lastUpdated: 'Dernière mise à jour : mai 2026',
    sections: [
      {
        heading: '1. Portée du service',
        body: 'ReceiptIQ est une application mobile qui vous aide à suivre vos dépenses personnelles et à gérer votre budget. L\'application est fournie à des fins personnelles uniquement.',
      },
      {
        heading: '2. Responsabilité du compte',
        body: 'Vous êtes responsable de la sécurité de votre compte. Ne partagez votre mot de passe avec personne. Vous êtes responsable de toutes les activités qui se produisent sous votre compte.',
      },
      {
        heading: '3. Utilisation interdite',
        body: 'Vous ne pouvez pas utiliser l\'application à des fins illégales, d\'une manière nuisible aux autres ou compromettant l\'intégrité du système.',
      },
      {
        heading: '4. Modifications du service',
        body: 'ReceiptIQ se réserve le droit de modifier ou d\'interrompre les fonctionnalités de l\'application avec ou sans préavis.',
      },
      {
        heading: '5. Limitation de responsabilité',
        body: 'ReceiptIQ ne peut être tenu responsable des dommages indirects résultant de l\'utilisation de l\'application. Veuillez consulter un professionnel pour vos décisions financières.',
      },
      {
        heading: '6. Contact',
        body: 'Pour toute question sur nos conditions d\'utilisation : support@receiptiq.app',
      },
    ],
  },
  ru: {
    title: 'Условия использования',
    lastUpdated: 'Последнее обновление: май 2026',
    sections: [
      {
        heading: '1. Объём услуг',
        body: 'ReceiptIQ — мобильное приложение для отслеживания личных расходов и управления бюджетом. Приложение предназначено только для личного использования.',
      },
      {
        heading: '2. Ответственность за аккаунт',
        body: 'Вы несёте ответственность за безопасность своего аккаунта. Не сообщайте пароль никому. Вы несёте ответственность за все действия, совершённые в вашем аккаунте.',
      },
      {
        heading: '3. Запрещённое использование',
        body: 'Вы не можете использовать приложение в незаконных целях, способами, наносящими вред другим или нарушающими целостность системы.',
      },
      {
        heading: '4. Изменения сервиса',
        body: 'ReceiptIQ оставляет за собой право изменять или прекращать работу функций приложения с уведомлением или без него.',
      },
      {
        heading: '5. Ограничение ответственности',
        body: 'ReceiptIQ не несёт ответственности за косвенный ущерб, возникший в результате использования приложения. Пожалуйста, обращайтесь к профессионалам по финансовым вопросам.',
      },
      {
        heading: '6. Контакты',
        body: 'По вопросам об условиях использования: support@receiptiq.app',
      },
    ],
  },
};

function PolicyScreen({ navigation, route }) {
  const { type } = route.params; // 'privacy' | 'terms'
  const { colors } = useTheme();
  const { language } = useLanguage();

  const content = useMemo(() => {
    const source = type === 'privacy' ? PRIVACY_CONTENT : TERMS_CONTENT;
    return source[language] || source.en;
  }, [type, language]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: s(20), paddingBottom: vs(12) }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ backgroundColor: colors.card, padding: s(8), borderRadius: s(12), marginRight: s(16) }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textMain} />
        </TouchableOpacity>
        <Text style={{ fontSize: ms(20), fontWeight: '800', color: colors.textMain, flex: 1 }}>
          {content.title}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: s(20), paddingTop: vs(4) }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: ms(12), color: colors.textSecondary, marginBottom: vs(24) }}>
          {content.lastUpdated}
        </Text>

        {content.sections.map((section, index) => (
          <View key={index} style={{ marginBottom: vs(24) }}>
            <Text style={{ fontSize: ms(15), fontWeight: '700', color: colors.textMain, marginBottom: vs(8) }}>
              {section.heading}
            </Text>
            <Text style={{ fontSize: ms(14), color: colors.textSecondary, lineHeight: vs(22) }}>
              {section.body}
            </Text>
          </View>
        ))}

        <View style={{
          marginTop: vs(8), padding: s(16), borderRadius: s(16),
          backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
        }}>
          <Text style={{ fontSize: ms(12), color: colors.textSecondary, textAlign: 'center', lineHeight: vs(18) }}>
            ReceiptIQ © 2026 — support@receiptiq.app
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default PolicyScreen;
