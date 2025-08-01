import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const App = () => {
  // State management
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [endpoints, setEndpoints] = useState([]);
  const [newEndpoint, setNewEndpoint] = useState('');
  const [messages, setMessages] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, error
  const [syncInterval, setSyncInterval] = useState(60); // seconds
  const [endpointStatus, setEndpointStatus] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Storage keys
  const STORAGE_KEYS = {
    ENDPOINTS: 'sms_forwarder_endpoints',
    LAST_SYNC: 'sms_forwarder_last_sync',
    SYNC_INTERVAL: 'sms_forwarder_sync_interval',
  };

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  // Auto-sync effect
  useEffect(() => {
    if (permissionsGranted && endpoints.length > 0) {
      const interval = setInterval(() => {
        syncMessages();
      }, syncInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [permissionsGranted, endpoints, syncInterval]);

  const initializeApp = async () => {
    try {
      await loadStoredData();
      await checkPermissions();
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize app');
    }
  };

  const loadStoredData = async () => {
    try {
      const storedEndpoints = await AsyncStorage.getItem(STORAGE_KEYS.ENDPOINTS);
      const storedLastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      const storedSyncInterval = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_INTERVAL);

      if (storedEndpoints) {
        setEndpoints(JSON.parse(storedEndpoints));
      }
      if (storedLastSync) {
        setLastSyncTime(new Date(storedLastSync));
      }
      if (storedSyncInterval) {
        setSyncInterval(parseInt(storedSyncInterval));
      }
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const result = await check(PERMISSIONS.ANDROID.READ_SMS);
        
        if (result === RESULTS.GRANTED) {
          setPermissionsGranted(true);
          loadMessages();
        } else {
          setPermissionsGranted(false);
        }
      }
    } catch (error) {
      console.error('Permission check error:', error);
      setPermissionsGranted(false);
    }
  };

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const result = await request(PERMISSIONS.ANDROID.READ_SMS);
        
        if (result === RESULTS.GRANTED) {
          setPermissionsGranted(true);
          loadMessages();
        } else {
          Alert.alert(
            'Permission Required',
            'SMS reading permission is required for this app to function. Please grant the permission in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => checkPermissions() }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Permission request error:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  const loadMessages = async () => {
    if (!permissionsGranted) return;

    try {
      setLoading(true);
      
      // For now, we'll use mock data since SMS libraries are problematic
      // In a real implementation, you would use a working SMS library
      const mockMessages = [
        {
          id: '1',
          address: '+1234567890',
          body: 'Test message 1 - This is a sample SMS for testing',
          timestamp: new Date(Date.now() - 60000), // 1 minute ago
          read: true,
        },
        {
          id: '2',
          address: '+0987654321',
          body: 'Test message 2 - Another sample SMS message',
          timestamp: new Date(Date.now() - 120000), // 2 minutes ago
          read: true,
        },
        {
          id: '3',
          address: '+1122334455',
          body: 'Test message 3 - Third sample message for testing',
          timestamp: new Date(Date.now() - 180000), // 3 minutes ago
          read: false,
        },
      ];

      setMessages(mockMessages);
      setLoading(false);
      
      console.log('Loaded mock SMS messages. In production, use a working SMS library.');
    } catch (error) {
      console.error('Error loading messages:', error);
      setLoading(false);
    }
  };

  const addEndpoint = async () => {
    if (!newEndpoint.trim()) {
      Alert.alert('Error', 'Please enter a valid endpoint URL');
      return;
    }

    // Validate URL format
    try {
      const url = new URL(newEndpoint.trim());
      if (url.protocol !== 'https:') {
        Alert.alert('Error', 'Only HTTPS endpoints are allowed for security');
        return;
      }
    } catch (error) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    const endpoint = newEndpoint.trim();
    const updatedEndpoints = [...endpoints, endpoint];
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ENDPOINTS, JSON.stringify(updatedEndpoints));
      setEndpoints(updatedEndpoints);
      setNewEndpoint('');
      
      // Test the new endpoint
      testEndpoint(endpoint);
    } catch (error) {
      console.error('Error saving endpoint:', error);
      Alert.alert('Error', 'Failed to save endpoint');
    }
  };

  const removeEndpoint = async (index) => {
    const updatedEndpoints = endpoints.filter((_, i) => i !== index);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ENDPOINTS, JSON.stringify(updatedEndpoints));
      setEndpoints(updatedEndpoints);
      
      // Remove status for this endpoint
      const newStatus = { ...endpointStatus };
      delete newStatus[endpoints[index]];
      setEndpointStatus(newStatus);
    } catch (error) {
      console.error('Error removing endpoint:', error);
      Alert.alert('Error', 'Failed to remove endpoint');
    }
  };

  const testEndpoint = async (endpoint) => {
    try {
      setEndpointStatus(prev => ({ ...prev, [endpoint]: 'testing' }));
      
      const response = await axios.post(endpoint, {
        messages: [],
        sync_time: new Date().toISOString(),
        test: true
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.status === 200) {
        setEndpointStatus(prev => ({ ...prev, [endpoint]: 'success' }));
        setTimeout(() => {
          setEndpointStatus(prev => ({ ...prev, [endpoint]: 'idle' }));
        }, 3000);
      } else {
        setEndpointStatus(prev => ({ ...prev, [endpoint]: 'error' }));
      }
    } catch (error) {
      console.error('Endpoint test failed:', error);
      setEndpointStatus(prev => ({ ...prev, [endpoint]: 'error' }));
    }
  };

  const syncMessages = async () => {
    if (!permissionsGranted || endpoints.length === 0 || syncStatus === 'syncing') {
      return;
    }

    try {
      setSyncStatus('syncing');
      
      // Get messages since last sync
      const messagesToSync = lastSyncTime 
        ? messages.filter(msg => msg.timestamp > lastSyncTime)
        : messages.slice(0, 10); // First sync: send last 10 messages

      if (messagesToSync.length === 0) {
        setSyncStatus('idle');
        return;
      }

      const payload = {
        messages: messagesToSync.map(msg => ({
          address: msg.address,
          body: msg.body,
          timestamp: msg.timestamp.toISOString(),
        })),
        sync_time: new Date().toISOString(),
      };

      // Send to all endpoints
      const promises = endpoints.map(async (endpoint) => {
        try {
          setEndpointStatus(prev => ({ ...prev, [endpoint]: 'syncing' }));
          
          const response = await axios.post(endpoint, payload, {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (response.status === 200) {
            setEndpointStatus(prev => ({ ...prev, [endpoint]: 'success' }));
            return { endpoint, success: true };
          } else {
            setEndpointStatus(prev => ({ ...prev, [endpoint]: 'error' }));
            return { endpoint, success: false };
          }
        } catch (error) {
          console.error(`Sync failed for ${endpoint}:`, error);
          setEndpointStatus(prev => ({ ...prev, [endpoint]: 'error' }));
          return { endpoint, success: false };
        }
      });

      const results = await Promise.allSettled(promises);
      const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value.success)
        .map(result => result.value);

      if (successfulResults.length > 0) {
        // Update last sync time only if at least one endpoint succeeded
        const newSyncTime = new Date();
        setLastSyncTime(newSyncTime);
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, newSyncTime.toISOString());
      }

      setSyncStatus('idle');
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'syncing': return '#2196F3';
      case 'testing': return '#FF9800';
      default: return '#757575';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'syncing': return '⟳';
      case 'testing': return '⚡';
      default: return '○';
    }
  };

  const renderMessage = ({ item }) => (
    <View style={styles.messageItem}>
      <View style={styles.messageHeader}>
        <Text style={styles.messageAddress}>{item.address}</Text>
        <Text style={styles.messageTime}>
          {item.timestamp.toLocaleTimeString()}
        </Text>
      </View>
      <Text style={styles.messageBody} numberOfLines={2}>
        {item.body}
      </Text>
    </View>
  );

  const renderEndpoint = ({ item, index }) => (
    <View style={styles.endpointItem}>
      <View style={styles.endpointInfo}>
        <Text style={styles.endpointUrl}>{item}</Text>
        <View style={styles.endpointActions}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => testEndpoint(item)}
          >
            <Text style={styles.testButtonText}>Test</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeEndpoint(index)}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.statusIndicator}>
        <Text style={[
          styles.statusText,
          { color: getStatusColor(endpointStatus[item] || 'idle') }
        ]}>
          {getStatusText(endpointStatus[item] || 'idle')}
        </Text>
      </View>
    </View>
  );

  if (!permissionsGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>SMS Forwarder</Text>
          <Text style={styles.permissionText}>
            This app needs SMS reading permission to forward your messages to configured endpoints.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SMS Forwarder</Text>
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Status: {syncStatus === 'idle' ? 'Ready' : syncStatus === 'syncing' ? 'Syncing...' : 'Error'}
            </Text>
            {syncStatus === 'syncing' && <ActivityIndicator size="small" color="#2196F3" />}
          </View>
        </View>

        {/* Endpoint Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Endpoints</Text>
          <View style={styles.addEndpointContainer}>
            <TextInput
              style={styles.endpointInput}
              placeholder="Enter HTTPS endpoint URL"
              value={newEndpoint}
              onChangeText={setNewEndpoint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.addButton} onPress={addEndpoint}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {endpoints.length > 0 && (
            <FlatList
              data={endpoints}
              renderItem={renderEndpoint}
              keyExtractor={(item, index) => index.toString()}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last Sync:</Text>
            <Text style={styles.statusValue}>
              {lastSyncTime ? lastSyncTime.toLocaleString() : 'Never'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Messages:</Text>
            <Text style={styles.statusValue}>{messages.length}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Endpoints:</Text>
            <Text style={styles.statusValue}>{endpoints.length}</Text>
          </View>
          
          <TouchableOpacity style={styles.syncButton} onPress={syncMessages}>
            <Text style={styles.syncButtonText}>Manual Sync</Text>
          </TouchableOpacity>
        </View>

        {/* Messages Section */}
        <View style={styles.section}>
          <View style={styles.messagesHeader}>
            <Text style={styles.sectionTitle}>Recent Messages</Text>
            {loading && <ActivityIndicator size="small" color="#2196F3" />}
          </View>
          
          {messages.length > 0 ? (
            <FlatList
              data={messages.slice(0, 20)} // Show only first 20 messages
              renderItem={renderMessage}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.noMessagesText}>No messages found</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  addEndpointContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  endpointInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    marginRight: 10,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  endpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  endpointInfo: {
    flex: 1,
  },
  endpointUrl: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  endpointActions: {
    flexDirection: 'row',
  },
  testButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  removeButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusIndicator: {
    marginLeft: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  messagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  messageItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  messageAddress: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
  },
  messageBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noMessagesText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default App; 