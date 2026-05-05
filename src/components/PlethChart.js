import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, PanResponder, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';
import { fetchPleth } from '../api';

const BUFFER_SECONDS  = 30;
const DISPLAY_SECONDS = 10;
const SAMPLE_RATE     = 50;
const BUFFER_SIZE     = BUFFER_SECONDS  * SAMPLE_RATE;   // 1500
const DISPLAY_SIZE    = DISPLAY_SECONDS * SAMPLE_RATE;   // 500
const MAX_OFFSET      = BUFFER_SIZE - DISPLAY_SIZE;      // 1000
const POLL_MS         = 200;   // how often we ask the Pi for new pleth samples
const EDGE_ZONE       = 0.15;
const MAX_SCROLL_STEP = 10;

function mockSample(t) {
  const f = 72 / 60;
  const p = 2 * Math.PI * f * t;
  return 0.55*Math.sin(p) + 0.25*Math.sin(2*p - 0.3) + 0.08*Math.sin(3*p) + (Math.random()-0.5)*0.04;
}

export default function PlethChart({ onChartPress, width, landscape = false }) {
  const { height: screenH } = useWindowDimensions();
  const H = landscape ? screenH - 40 : 160;

  const bufferRef       = useRef([]);
  const sinceRef        = useRef(null);   // last ts we received from the Pi (ms)
  const mockTRef        = useRef(BUFFER_SIZE / SAMPLE_RATE);
  const viewOffsetRef   = useRef(0);
  const isDraggingRef   = useRef(false);
  const widthRef        = useRef(width);
  const HRef            = useRef(H);
  const onChartPressRef = useRef(onChartPress);
  const deviceOkRef     = useRef(false);  // true once we get real data

  useEffect(() => { widthRef.current      = width;        }, [width]);
  useEffect(() => { HRef.current          = H;            }, [H]);
  useEffect(() => { onChartPressRef.current = onChartPress; }, [onChartPress]);

  const [displayed,  setDisplayed]  = useState([]);
  const [viewOffset, setViewOffset] = useState(0);
  const [dragX,      setDragX]      = useState(null);
  const [isLive,     setIsLive]     = useState(true);

  const refreshDisplay = useCallback(() => {
    const buf = bufferRef.current;
    const off = viewOffsetRef.current;
    const end = buf.length - off;
    setDisplayed(buf.slice(Math.max(0, end - DISPLAY_SIZE), end));
    setIsLive(off === 0);
    setViewOffset(off);
  }, []);

  // Seed buffer with mock data on first render
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

  // Poll Pi for real pleth data; fall back to mock when unreachable
  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const result = await fetchPleth(sinceRef.current);
        if (!active) return;

        const incoming = result.samples ?? [];
        if (incoming.length > 0) {
          deviceOkRef.current = true;
          // Replace mock history once with device data on first successful fetch
          if (sinceRef.current === null && incoming.length >= DISPLAY_SIZE) {
            bufferRef.current = incoming.slice(-BUFFER_SIZE).map(s => ({ ts: s.ts, v: s.v }));
          } else {
            for (const s of incoming) {
              bufferRef.current.push({ ts: s.ts, v: s.v });
              if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift();
            }
          }
          sinceRef.current = incoming[incoming.length - 1].ts;
          if (viewOffsetRef.current === 0) refreshDisplay();
        }
      } catch {
        // Device unreachable — advance mock data so chart keeps moving
        if (!deviceOkRef.current) {
          mockTRef.current += POLL_MS / 1000;
          const steps = Math.round(POLL_MS / (1000 / SAMPLE_RATE));
          const now = Date.now();
          for (let i = 0; i < steps; i++) {
            mockTRef.current += 1 / SAMPLE_RATE;
            bufferRef.current.push({ ts: now - (steps - i) * (1000 / SAMPLE_RATE), v: mockSample(mockTRef.current) });
            if (bufferRef.current.length > BUFFER_SIZE) bufferRef.current.shift();
          }
          if (viewOffsetRef.current === 0) refreshDisplay();
        }
      }
    };

    const interval = setInterval(poll, POLL_MS);
    poll();  // immediate first call
    return () => { active = false; clearInterval(interval); };
  }, [refreshDisplay]);

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
        const buf = bufferRef.current;
        const end = buf.length - newOff;
        setDisplayed(buf.slice(Math.max(0, end - DISPLAY_SIZE), end));
        setIsLive(newOff === 0);
        setViewOffset(newOff);
      }
    },

    onPanResponderRelease: (evt) => {
      const w    = widthRef.current;
      const x    = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
      const buf  = bufferRef.current;
      const off  = viewOffsetRef.current;
      const end  = buf.length - off;
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

  let dragLabel = null;
  if (dragX !== null && displayed.length > 0) {
    const idx = Math.round((dragX / width) * (displayed.length - 1));
    const ts  = displayed[Math.min(idx, displayed.length - 1)]?.ts;
    if (ts) dragLabel = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <View {...panResponder.panHandlers} style={{ position: 'relative' }}>
      <Svg width={width} height={H}>
        <Rect x={0} y={0} width={width} height={H} fill={colors.card} rx={landscape ? 0 : 12} />
        <Line
          x1={pad} y1={H / 2} x2={width - pad} y2={H / 2}
          stroke={colors.border} strokeWidth={1} strokeDasharray="4,4"
        />
        {pathD ? <Path d={pathD} stroke={colors.primary} strokeWidth={1.8} fill="none" /> : null}
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

      <View style={{ position: 'absolute', top: 6, right: 10, pointerEvents: 'none' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: isLive ? colors.success : colors.warning }}>
          {isLive ? (deviceOkRef.current ? '● LIVE' : '● DEMO') : `◀ ${Math.round(viewOffset / SAMPLE_RATE)}s ago`}
        </Text>
      </View>
    </View>
  );
}
