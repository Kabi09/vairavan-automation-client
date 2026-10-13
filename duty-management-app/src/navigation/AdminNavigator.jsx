import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AllDutiesScreen from '../screens/admin/AllDutiesScreen';
import CompanyListScreen from '../screens/admin/CompanyListScreen';
import CompanyFormScreen from '../screens/admin/CompanyFormScreen';
import CompanyDetailsScreen from '../screens/admin/CompanyDetailsScreen';
import EmployeeListScreen from '../screens/admin/EmployeeListScreen';
import EmployeeFormScreen from '../screens/admin/EmployeeFormScreen';
import EmployeeDetailsScreen from '../screens/admin/EmployeeDetailsScreen';
import LeaveRequestsScreen from '../screens/admin/LeaveRequestsScreen';
import HolidayManagementScreen from '../screens/admin/HolidayManagementScreen';
import DutyDetailsScreen from '../screens/employee/DutyDetailsScreen';
import DutyFormScreen from '../screens/employee/DutyFormScreen';
import NotificationsScreen from '../screens/admin/NotificationsScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import ChangePasswordScreen from '../screens/common/ChangePasswordScreen';
import LeaveRequestScreen from '../screens/employee/LeaveRequestScreen';
import MyLeavesScreen from '../screens/employee/MyLeavesScreen';
import { COLORS } from '../constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const AdminTabs = () => {
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
          } else if (route.name === 'DutiesTab') {
            iconName = focused ? 'clipboard' : 'clipboard-outline';
          } else if (route.name === 'CompaniesTab') {
            iconName = focused ? 'business' : 'business-outline';
          } else if (route.name === 'EmployeesTab') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'LeavesTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          }
          return <Ionicons name={iconName} size={size || 22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={AdminDashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="DutiesTab"
        component={AllDutiesScreen}
        options={{ tabBarLabel: 'Duties' }}
      />
      <Tab.Screen
        name="CompaniesTab"
        component={CompanyListScreen}
        options={{ tabBarLabel: 'Companies' }}
      />
      <Tab.Screen
        name="EmployeesTab"
        component={EmployeeListScreen}
        options={{ tabBarLabel: 'Staff' }}
      />
      <Tab.Screen
        name="LeavesTab"
        component={LeaveRequestsScreen}
        options={{ tabBarLabel: 'Leaves' }}
      />
    </Tab.Navigator>
  );
};

export const AdminNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminMainTabs" component={AdminTabs} />
      <Stack.Screen name="CompanyDetails" component={CompanyDetailsScreen} />
      <Stack.Screen name="CompanyForm" component={CompanyFormScreen} />
      <Stack.Screen name="EmployeeDetails" component={EmployeeDetailsScreen} />
      <Stack.Screen name="EmployeeForm" component={EmployeeFormScreen} />
      <Stack.Screen name="HolidayManagement" component={HolidayManagementScreen} />
      <Stack.Screen name="DutyDetails" component={DutyDetailsScreen} />
      <Stack.Screen name="DutyForm" component={DutyFormScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="MyLeaves" component={MyLeavesScreen} />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
