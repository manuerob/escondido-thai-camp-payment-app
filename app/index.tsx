import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  useWindowDimensions,
  ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  
  const isTablet = width >= 768;
  const isLandscape = width > height;

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[
          styles.content,
          isTablet && styles.tabletContent
        ]}>
          <Text style={[
            styles.title,
            isTablet && styles.tabletTitle
          ]}>
            Escondido Thai Camp
          </Text>
          
          <Text style={[
            styles.subtitle,
            isTablet && styles.tabletSubtitle
          ]}>
            Payment Management System
          </Text>
          
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Device: {isTablet ? 'iPad' : 'iPhone'}
            </Text>
            <Text style={styles.infoText}>
              Orientation: {isLandscape ? 'Landscape' : 'Portrait'}
            </Text>
            <Text style={styles.infoText}>
              Screen: {Math.round(width)} x {Math.round(height)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Stats</Text>
            <Text style={styles.cardText}>Use the menu to navigate</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabletContent: {
    paddingHorizontal: 60,
    paddingVertical: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  tabletTitle: {
    fontSize: 42,
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  tabletSubtitle: {
    fontSize: 24,
    marginBottom: 60,
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    marginVertical: 5,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
    maxWidth: 400,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    color: '#666',
  },
});
