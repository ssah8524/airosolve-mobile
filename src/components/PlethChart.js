import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, PanResponder, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

const BUFFER_SECONDS  = 30;
const DISPLAY_SECONDS = 10;
const SAMPLE_RATE     = 50;
const BUFFER_SIZE     = BUFFER_SECONDS  * SAMPLE_RATE;   // 1500
const DISPLAY_SIZE    = DISPLAY_SECONDS * SAMPLE_RATE;   // 500
const MAX_OFFSET      = BUFFER_SIZE - DISPLAY_SIZE;      // 1000
const UPDATE_MS       = 40;
const EDGE_ZONE       = 0.15;   // 15% of width triggers scrolling
const MAX_SCROLL_STEP = 10;     // samples per move event at max edge depth

function mockSample(t) {
  const f = 72 / 60;
  const p = 2 * Math.PI * f * t;
  return 0.55*Math.sin(p) + 0.25*Math.sin(2*p - 0.3) + 0.08*Math.sin(3*p) + (Math.random()-0.5)*0.04;
}

export default function PlethChart({ onChartPress, width, landscape = false }) {
  const { height: screenH } = useWindowDimensions();
  const H = landscape ? screenH - 40 : 160;

  // Mutable refs — no re-render on change
  const bufferRef         = useRef([]);
  const tRef              = useRef(BUFFER_SIZE / SAMPLE_RATE);
  const viewOffsetRef     = useRef(0);
  const isDraggingRef     = useRef(false);
  const widthRef          = useRef(width);
  const HRef              = useRef(H);
  const onChartPressRef   = useRef(onChartPress);

  useEffect(() => { widthRef.current      = width;        }, [width]);
  useEffect(() => { HRef.current          = H;            }, [H]);
  useEffect(() => { onChartPressRef.current = onChartPress; }, [onChartPress]);

  const [displayed,   setDisplayed]   = useState([]);
  const [viewOffset,  setViewOffset]  = useState(0);  // for LIVE indicator only
  const [dragX,       setDragX]       = useState(null);

  const refreshDisplay = useCallback(() => {
    const buf = bufferRef.current;
    const off = viewOffsetRef.current;
    const end = buf.length - off;
    const start = Math.max(0, end - DISPLAY_SIZE);
    setDisplayed(buf.slice(start, end));
  }, []);

  // Initialise buffer
  useEffect(() => {
    const now = Date.now();
    for (let i = 0; i < BUFFER_SIZE; i++) {
      bufferRef.current.push({
        ts: now - (BUFFER_SIZE - i) * (1000 / SAMPLE_RATE),
        v:  mockSample(i / SAMPLE_RATE),
      });
    }
    refreshDisplay();
  }, [refreshDisplay]);

  // Live data feed
  useEffect(() => {
    const interval = setInterval(() => {
      tRef.current += 1 / SAMPLE_RATE;
      bufferRef.current.push({ ts: Date.now(), v: mockSample(tRef.current) });
      if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift();
      if (viewOffsetRef.current === 0) refreshDisplay();
    }, UPDATE_MS);
    return () => clearInterval(interval);
  }, [refreshDisplay]);

  // PanResponder — created once, uses refs for all mutable values
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (evt) => {
      isDraggingRef.current = true;
      setDragX(evt.nativeEvent.locationX);
    },

    onPanResponderMove: (evt) => {
      const w = widthRef.current;
      const x = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
      setDragX(x);

      // Edge scrolling
      const edgeW = w * EDGE_ZONE;
      let newOff = viewOffsetRef.current;
      if (x < edgeW) {
        const depth = 1 - x / edgeW;
        newOff = Math.min(newOff + Math.ceil(depth * MAX_SCROLL_STEP), MAX_OFFSET);
      } else if (x > w - edgeW) {
        const depth = (x - (w - edgeW)) / edgeW;
        newOff = Math.max(newOff - Math.ceil(depth * MAX_SCROLL_STEP), 0);
      }

      if (newOff !== viewOffsetRef.current) {
        viewOffsetRef.current = newOff;
        setViewOffset(newOff);
        const buf = bufferRef.current;
        const end = buf.length - newOff;
        setDisplayed(buf.slice(Math.max(0, end - DISPLAY_SIZE), end));
      }
    },

    onPanResponderRelease: (evt) => {
      const w   = widthRef.current;
      const x   = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
      const buf = bufferRef.current;
      const off = viewOffsetRef.current;
      const end = buf.length - off;
      const disp = buf.slice(Math.max(0, end - DISPLAY_SIZE), end);

      if (disp.length > 0) {
        const idx = Math.round((x / w) * (disp.length - 1));
        const tappedTime = new Date(disp[Math.min(idx, disp.length - 1)].ts);
        setTimeout(() => {
          isDraggingRef.current = false;
          setDragX(null);
          onChartPressRef.current?.(tappedTime);
        }, 300);
      } else {
        isDraggingRef.current = false;
        setDragX(null);
      }
    },

    onPanResponderTerminate: () => {
      isDraggingRef.current = false;
      setDragX(null);
    },
  })).current;

  // ── SVG rendering ────────────────────────────────────────────────────────
  const pad = 8;
  const w   = width - pad * 2;

  let pathD = '';
  if (displayed.length > 1) {
    const vals = displayed.map(s => s.v);
    const minV = Math.min(...vals);
    const range = (Math.max(...vals) - minV) || 1;
    pathD = displayed.map((s, i) => {
      const x = pad + (i / (displayed.length - 1)) * w;
      const y = pad + (1 - (s.v - minV) / range) * (H - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // Timestamp label next to drag line
  let dragLabel = null;
  if (dragX !== null && displayed.length > 0) {
    const idx = Math.round((dragX / width) * (displayed.length - 1));
    const ts  = displayed[Math.min(idx, displayed.length - 1)]?.ts;
    if (ts) dragLabel = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  const isLive = viewOffset === 0;

  return (
    <View {...panResponder.panHandlers} style={{ position: 'relative' }}>
      <Svg width={width} height={H}>
        <Rect x={0} y={0} width={width} height={H} fill={colors.card} rx={landscape ? 0 : 12} />
        {/* Mid-line grid */}
        <Line
          x1={pad} y1={H / 2} x2={width - pad} y2={H / 2}
          stroke={colors.border} strokeWidth={1} strokeDasharray="4,4"
        />
        {/* Waveform */}
        {pathD ? <Path d={pathD} stroke={colors.primary} strokeWidth={1.8} fill="none" /> : null}
        {/* Drag indicator */}
        {dragX !== null && (
          <>
            <Line x1={dragX} y1={pad} x2={dragX} y2={H - pad} stroke={colors.danger} strokeWidth={2} />
            <Circle cx={dragX} cy={H / 2} r={6} fill={colors.danger} />
            {dragLabel && (
              <SvgText
                x={Math.min(dragX + 8, width - 90)}
                y={pad + 16}
                fontSize={11}
                fill={colors.danger}
                fontWeight="600"
              >
                {dragLabel}
              </SvgText>
            )}
          </>
        )}
      </Svg>

      {/* LIVE / history indicator */}
      <View style={{ position: 'absolute', top: 6, right: 10, pointerEvents: 'none' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: isLive ? colors.success : colors.warning }}>
          {isLive ? '● LIVE' : `◀ ${Math.round(viewOffset / SAMPLE_RATE)}s ago`}
        </Text>
      </View>
    </View>
  );
}
