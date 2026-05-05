import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, PanResponder, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';
import { fetchPleth } from '../api';

const BUFFER_MS  = 30_000;   // keep 30 s of history
const DISPLAY_MS = 10_000;   // always render a 10 s window
const POLL_MS    = 200;
const MOCK_HZ    = 50;       // mock sample rate when device is offline

// How far back (ms) the user can scroll from the live edge
const MAX_SCROLL_MS  = BUFFER_MS;   // full 30 s
const EDGE_ZONE      = 0.15;
const MAX_SCROLL_STEP = 500;   // ms per move event at max edge depth

function mockSample(t) {
  const f = 72 / 60;
  const p = 2 * Math.PI * f * t;
  return 0.55*Math.sin(p) + 0.25*Math.sin(2*p - 0.3) + 0.08*Math.sin(3*p) + (Math.random()-0.5)*0.04;
}

export default function PlethChart({ onChartPress, width, landscape = false }) {
  const { height: screenH } = useWindowDimensions();
  const H = landscape ? screenH - 40 : 160;

  // All mutable values in refs — no re-renders on change
  const bufferRef       = useRef([]);   // [{ts: epoch_ms, v: number}]
  const sinceRef        = useRef(null); // last ts from Pi (ms)
  const mockTRef        = useRef(BUFFER_MS / 1000);
  const scrollMsRef     = useRef(0);    // ms offset from live edge (0 = live)
  const isDraggingRef   = useRef(false);
  const widthRef        = useRef(width);
  const HRef            = useRef(H);
  const onChartPressRef = useRef(onChartPress);
  const deviceOkRef     = useRef(false);

  useEffect(() => { widthRef.current       = width;        }, [width]);
  useEffect(() => { HRef.current           = H;            }, [H]);
  useEffect(() => { onChartPressRef.current = onChartPress; }, [onChartPress]);

  const [displayed,  setDisplayed]  = useState([]);
  const [scrollMs,   setScrollMs]   = useState(0);   // for indicator only
  const [dragX,      setDragX]      = useState(null);
  const [isLive,     setIsLive]     = useState(true);

  // Slice the buffer to a 10 s window ending at (latestTs - scrollMs)
  const refreshDisplay = useCallback(() => {
    const buf = bufferRef.current;
    if (buf.length === 0) return;
    const tEnd   = buf[buf.length - 1].ts - scrollMsRef.current;
    const tStart = tEnd - DISPLAY_MS;
    setDisplayed(buf.filter(s => s.ts >= tStart && s.ts <= tEnd));
    setIsLive(scrollMsRef.current === 0);
    setScrollMs(scrollMsRef.current);
  }, []);

  // Seed 30 s of mock data so the chart is never empty on first render
  useEffect(() => {
    const now  = Date.now();
    const step = 1000 / MOCK_HZ;
    const n    = Math.round(BUFFER_MS / step);
    for (let i = 0; i < n; i++) {
      bufferRef.current.push({
        ts: now - (n - i) * step,
        v:  mockSample(i / MOCK_HZ),
      });
    }
    refreshDisplay();
  }, [refreshDisplay]);

  // Poll the Pi for real samples; fall back to advancing mock when unreachable
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const result  = await fetchPleth(sinceRef.current);
        if (!active) return;
        const incoming = result.samples ?? [];
        if (incoming.length > 0) {
          deviceOkRef.current = true;
          if (sinceRef.current === null) {
            // First successful fetch — replace seed with real history
            bufferRef.current = incoming.map(s => ({ ts: s.ts, v: s.v }));
          } else {
            for (const s of incoming) bufferRef.current.push({ ts: s.ts, v: s.v });
          }
          // Trim to 30 s of history
          const cutoff = incoming[incoming.length - 1].ts - BUFFER_MS;
          bufferRef.current = bufferRef.current.filter(s => s.ts >= cutoff);
          sinceRef.current = incoming[incoming.length - 1].ts;
          if (scrollMsRef.current === 0) refreshDisplay();
        }
      } catch {
        // Device unreachable — keep mock moving so chart animates
        if (!deviceOkRef.current) {
          const now  = Date.now();
          const step = 1000 / MOCK_HZ;
          const n    = Math.round(POLL_MS / step);
          for (let i = 0; i < n; i++) {
            mockTRef.current += 1 / MOCK_HZ;
            bufferRef.current.push({ ts: now - (n - i) * step, v: mockSample(mockTRef.current) });
          }
          const cutoff = now - BUFFER_MS;
          bufferRef.current = bufferRef.current.filter(s => s.ts >= cutoff);
          if (scrollMsRef.current === 0) refreshDisplay();
        }
      }
    };
    const id = setInterval(poll, POLL_MS);
    poll();
    return () => { active = false; clearInterval(id); };
  }, [refreshDisplay]);

  // PanResponder — all mutable state via refs
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
      let newScroll = scrollMsRef.current;
      if (x < edgeW) {
        const depth = 1 - x / edgeW;
        newScroll = Math.min(newScroll + Math.ceil(depth * MAX_SCROLL_STEP), MAX_SCROLL_MS);
      } else if (x > w - edgeW) {
        const depth = (x - (w - edgeW)) / edgeW;
        newScroll = Math.max(newScroll - Math.ceil(depth * MAX_SCROLL_STEP), 0);
      }

      if (newScroll !== scrollMsRef.current) {
        scrollMsRef.current = newScroll;
        const buf    = bufferRef.current;
        if (buf.length === 0) return;
        const tEnd   = buf[buf.length - 1].ts - newScroll;
        const tStart = tEnd - DISPLAY_MS;
        setDisplayed(buf.filter(s => s.ts >= tStart && s.ts <= tEnd));
        setIsLive(newScroll === 0);
        setScrollMs(newScroll);
      }
    },

    onPanResponderRelease: (evt) => {
      const w   = widthRef.current;
      const x   = Math.max(0, Math.min(evt.nativeEvent.locationX, w));
      const buf = bufferRef.current;
      if (buf.length === 0) { isDraggingRef.current = false; setDragX(null); return; }

      const tEnd   = buf[buf.length - 1].ts - scrollMsRef.current;
      const tStart = tEnd - DISPLAY_MS;
      const tapped = new Date(tStart + (x / w) * DISPLAY_MS);

      setTimeout(() => {
        isDraggingRef.current = false;
        setDragX(null);
        onChartPressRef.current?.(tapped);
      }, 300);
    },

    onPanResponderTerminate: () => {
      isDraggingRef.current = false;
      setDragX(null);
    },
  })).current;

  // ── SVG rendering — always maps 10 s to the full chart width ─────────────
  const pad = 8;
  const w   = width - pad * 2;

  let pathD   = '';
  let tStart  = 0;
  let tEnd    = 0;

  if (displayed.length > 1) {
    tEnd   = displayed[displayed.length - 1].ts;
    tStart = tEnd - DISPLAY_MS;

    const vals  = displayed.map(s => s.v);
    const minV  = Math.min(...vals);
    const range = (Math.max(...vals) - minV) || 1;

    pathD = displayed.map(s => {
      const x = pad + ((s.ts - tStart) / DISPLAY_MS) * w;
      const y = pad + (1 - (s.v - minV) / range) * (H - pad * 2);
      return `${s === displayed[0] ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // Drag-line label: derive time from pixel position
  let dragLabel = null;
  if (dragX !== null && displayed.length > 1) {
    const ts = tStart + (dragX / width) * DISPLAY_MS;
    dragLabel = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
          {isLive
            ? (deviceOkRef.current ? '● LIVE' : '● DEMO')
            : `◀ ${Math.round(scrollMs / 1000)}s ago`}
        </Text>
      </View>
    </View>
  );
}
