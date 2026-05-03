import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Rect, Circle } from 'react-native-svg';
import { colors } from '../theme';

const DISPLAY_SECONDS = 10;
const SAMPLE_RATE = 50;           // display points per second
const BUFFER_SIZE = DISPLAY_SECONDS * SAMPLE_RATE;  // 500 points
const UPDATE_MS = 40;             // ~25 fps
const TAP_LINE_DURATION = 350;    // ms to show tap indicator before navigating

function mockSample(t) {
  const hr = 72;
  const f = hr / 60;
  const phase = 2 * Math.PI * f * t;
  return (
    0.55 * Math.sin(phase) +
    0.25 * Math.sin(2 * phase - 0.3) +
    0.08 * Math.sin(3 * phase) +
    (Math.random() - 0.5) * 0.04
  );
}

export default function PlethChart({ onChartPress, width, landscape = false }) {
  const tRef = useRef(BUFFER_SIZE / SAMPLE_RATE);
  const [tapX, setTapX] = useState(null);

  const [samples, setSamples] = useState(() => {
    const now = Date.now();
    return Array.from({ length: BUFFER_SIZE }, (_, i) => ({
      ts: now - (BUFFER_SIZE - i) * (1000 / SAMPLE_RATE),
      v: mockSample(i / SAMPLE_RATE),
    }));
  });

  useEffect(() => {
    const dt = 1 / SAMPLE_RATE;
    const interval = setInterval(() => {
      tRef.current += dt;
      setSamples(prev => [
        ...prev.slice(1),
        { ts: Date.now(), v: mockSample(tRef.current) },
      ]);
    }, UPDATE_MS);
    return () => clearInterval(interval);
  }, []);

  const handlePress = useCallback((event) => {
    const x = event.nativeEvent.locationX;
    const fraction = Math.max(0, Math.min(x / width, 1));
    const idx = Math.floor(fraction * (samples.length - 1));
    const tappedTime = new Date(samples[idx].ts);
    setTapX(x);
    setTimeout(() => {
      setTapX(null);
      onChartPress?.(tappedTime);
    }, TAP_LINE_DURATION);
  }, [samples, width, onChartPress]);

  const { height: screenH } = useWindowDimensions();
  const H = landscape ? screenH - 40 : 160;
  const pad = 8;
  const w = width - pad * 2;

  const values = samples.map(s => s.v);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const pathD = samples.map((s, i) => {
    const x = pad + (i / (BUFFER_SIZE - 1)) * w;
    const y = pad + (1 - (s.v - minV) / range) * (H - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Svg width={width} height={H}>
        {/* Background */}
        <Rect x={0} y={0} width={width} height={H} fill={colors.card} rx={12} />
        {/* Midline grid */}
        <Line
          x1={pad} y1={H / 2} x2={width - pad} y2={H / 2}
          stroke={colors.border} strokeWidth={1} strokeDasharray="4,4"
        />
        {/* Waveform */}
        <Path d={pathD} stroke={colors.primary} strokeWidth={1.8} fill="none" />
        {/* Tap indicator */}
        {tapX !== null && (
          <>
            <Line
              x1={tapX} y1={pad} x2={tapX} y2={H - pad}
              stroke={colors.danger} strokeWidth={1.5}
            />
            <Circle cx={tapX} cy={H / 2} r={5} fill={colors.danger} />
          </>
        )}
      </Svg>
    </TouchableOpacity>
  );
}
