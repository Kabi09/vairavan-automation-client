import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import EmployeeDashboardScreen from '../screens/employee/EmployeeDashboardScreen';
import MyDutiesScreen from '../screens/employee/MyDutiesScreen';
import DutyFormScreen from '../screens/employee/DutyFormScreen';
import DutyDetailsScreen from '../screens/employee/DutyDetailsScreen';
import MyLeavesScreen from '../screens/employee/MyLeavesScreen';
import LeaveRequestScreen from '../screens/employee/LeaveRequestScreen';
import HolidayListScreen from '../screens/employee/HolidayListScreen';
import NotificationsScreen from '../screens/admin/NotificationsScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import ChangePasswordScreen from '../screens/common/ChangePasswordScreen';
import CompanyFormScreen from '../screens/admin/CompanyFormScreen';
import { COLORS } from '../constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const EmployeeTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'grid-outline';
          if (route.name === 'DashboardTab') {
            iconName = focused ? 'speedometer' : 'speedometer-outline';
          } else if (route.name === 'MyDutiesTab') {
            iconName = focused ? 'clipboard' : 'clipboard-outline';
          } else if (route.name === 'SubmitDutyTab') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'LeavesTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size || 22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={EmployeeDashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="MyDutiesTab"
        component={MyDutiesScreen}
        options={{ tabBarLabel: 'My Duties' }}
      />
      <Tab.Screen
        name="SubmitDutyTab"
        component={DutyFormScreen}
        options={{
          tabBarLabel: 'New Duty',
          tabBarActiveTintColor: COLORS.primary,
        }}
      />
      <Tab.Screen
        name="LeavesTab"
        component={MyLeavesScreen}
        options={{ tabBarLabel: 'Leaves' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export const EmployeeNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EmployeeMainTabs" component={EmployeeTabs} />
      <Stack.Screen name="DutyForm" component={DutyFormScreen} />
      <Stack.Screen name="CompanyForm" component={CompanyFormScreen} />
      <Stack.Screen name="DutyDetails" component={DutyDetailsScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="MyLeaves" component={MyLeavesScreen} />
      <Stack.Screen name="HolidayList" component={HolidayListScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
};

export default EmployeeNavigator;
