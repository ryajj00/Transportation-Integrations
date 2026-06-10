import React, { useEffect, useState } from 'react';
import { View, Button, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';

import { fetchFeature } from './utils/featureFetcher';

const MANILA_CENTER = { latitude: 14.61, longitude: 121.06 };
const INITIAL_REGION = {
  ...MANILA_CENTER,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export default function MapScreen() {
  const [feature, setFeature] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadSample() {
    try {
      setLoading(true);
      const f = await fetchFeature('lrt2_line_sample.geojson', 'lrt2_sample');
      setFeature(f);
    } catch (err) {
      console.warn('fetchFeature error', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.controls}>
        <Button title={loading ? 'Loading...' : 'Load LRT2 Sample'} onPress={loadSample} disabled={loading} />
        {feature && <Text style={styles.label}>Feature: {feature.properties?.name}</Text>}
      </View>

      <MapView style={styles.map} initialRegion={INITIAL_REGION}>
        {feature && feature.geometry && feature.geometry.type === 'LineString' && (
          <>
            <Polyline
              coordinates={feature.geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }))}
              strokeColor="#007cbf"
              strokeWidth={4}
            />
            {feature.geometry.coordinates.length > 0 && (
              <Marker
                coordinate={{
                  latitude: feature.geometry.coordinates[0][1],
                  longitude: feature.geometry.coordinates[0][0],
                }}
                title={feature.properties?.name}
              />
            )}
          </>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  controls: { padding: 12, backgroundColor: '#f5f5f5' },
  label: { marginTop: 8, fontSize: 14, color: '#333' },
  map: { flex: 1 },
});
