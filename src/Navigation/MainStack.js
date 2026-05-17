import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TabNavigator from './TabNavigator';
import AddReceiptScreen from '../Screens/App/AddReceipt/AddReceiptScreen';
import ReportsScreen from '../Screens/App/Reports/ReportsScreen';
import TransactionsScreen from '../Screens/App/Transactions/TransactionsScreen';
import BudgetScreen from '../Screens/App/Budget/BudgetScreen';
import ReviewReceiptScreen from '../Screens/App/ReviewReceipt';
import AlertsScreen from '../Screens/App/Alerts';
import PolicyScreen from '../Screens/App/Policy/PolicyScreen';
import RecurringScreen from '../Screens/App/Recurring/RecurringScreen';
import SavingsGoalScreen from '../Screens/App/SavingsGoal/SavingsGoalScreen';
import SavingsGoalChatScreen from '../Screens/App/SavingsGoal/SavingsGoalChatScreen';
import WeeklySummaryScreen from '../Screens/App/WeeklySummary/WeeklySummaryScreen';
import FinancialScoreScreen from '../Screens/App/FinancialScore/FinancialScoreScreen';
import FinancialScoreChatScreen from '../Screens/App/FinancialScore/FinancialScoreChatScreen';
import TagsScreen from '../Screens/App/Tags/TagsScreen';

const Stack = createStackNavigator();

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Alt menünün tamamı */}
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Budget" component={BudgetScreen} />
      <Stack.Screen name="Alerts" component={AlertsScreen} />

      {/* Modal: Manuel fiş ekleme */}
      <Stack.Screen
        name="AddReceipt"
        component={AddReceiptScreen}
        options={{ presentation: 'modal' }}
      />

      {/* Modal: Tarama sonrası gözden geçirme (Faz 1) */}
      <Stack.Screen
        name="ReviewReceipt"
        component={ReviewReceiptScreen}
        options={{ presentation: 'modal' }}
      />

      {/* Faz 7: Tekrarlayan işlemler */}
      <Stack.Screen name="Recurring" component={RecurringScreen} />

      {/* Faz 8: Tasarruf hedefi */}
      <Stack.Screen name="SavingsGoal" component={SavingsGoalScreen} />
      <Stack.Screen name="SavingsGoalChat" component={SavingsGoalChatScreen} />

      {/* Haftalık Özet */}
      <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />

      {/* Finansal Skor */}
      <Stack.Screen name="FinancialScore" component={FinancialScoreScreen} />
      <Stack.Screen name="FinancialScoreChat" component={FinancialScoreChatScreen} />

      {/* Etiket sistemi */}
      <Stack.Screen name="Tags" component={TagsScreen} />

      {/* Gizlilik Politikası & Kullanım Koşulları */}
      <Stack.Screen name="Policy" component={PolicyScreen} />
    </Stack.Navigator>
  );
}

export default MainStack;
