import React, { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './ui/Text';
import { colors } from '@/src/constants/colors';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;

export default function WheelPicker({ data, value, onChange, label }) {
  const flatListRef = useRef(null);
  
  // Add spacers for centering
  const paddedData = ['', ...data, ''];
  
  const selectedIndex = data.indexOf(value);
  const initialScrollIndex = selectedIndex !== -1 ? selectedIndex : 0;

  useEffect(() => {
    if (flatListRef.current && initialScrollIndex !== -1) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialScrollIndex,
          animated: false,
        });
      }, 100);
    }
  }, [initialScrollIndex]);

  const onMomentumScrollEnd = (event) => {
    const yOffset = event.nativeEvent.contentOffset.y;
    const index = Math.round(yOffset / ITEM_HEIGHT);
    
    if (index >= 0 && index < data.length) {
      const newValue = data[index];
      if (newValue !== value) {
        onChange(newValue);
        Haptics.selectionAsync();
      }
    }
  };

  const renderItem = ({ item, index }) => {
    const isSpacer = item === '';
    const realIndex = index - 1;
    const isSelected = data[realIndex] === value;

    if (isSpacer) {
      return <View style={{ height: ITEM_HEIGHT }} />;
    }

    let displayValue = String(item);
    if (label === 'Minute' || label === 'Hour') {
      displayValue = String(item).padStart(2, '0');
    }

    return (
      <Pressable
        onPress={() => {
          flatListRef.current?.scrollToIndex({ index: realIndex, animated: true });
        }}
        style={styles.item}
      >
        <Text
          style={[
            styles.itemText,
            isSelected && styles.itemTextSelected,
          ]}
          variant="subtitle"
        >
          {displayValue}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label} variant="caption" color="muted">
          {label}
        </Text>
      )}
      <View style={styles.pickerWrap}>
        <View style={styles.selectionHighlight} />
        <FlatList
          ref={flatListRef}
          data={paddedData}
          renderItem={renderItem}
          keyExtractor={(_, index) => index.toString()}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  pickerWrap: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    width: '100%',
    backgroundColor: '#F1F5FB',
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectionHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    backgroundColor: '#E0E7FF',
    borderRadius: 8,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: '#94A3B8',
  },
  itemTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
