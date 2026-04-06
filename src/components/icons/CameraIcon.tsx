import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

type CameraIconProps = {
  size?: number;
  color?: string;
};

export default function CameraIcon({ size = 24, color = '#ffffff' }: CameraIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Body */}
      <Rect x="2" y="7" width="20" height="14" rx="2.5" fill={color} opacity={0.9} />
      {/* Lens ring */}
      <Circle cx="12" cy="14" r="4" stroke={color} strokeWidth="1.8" fill="none" opacity={0.5} />
      <Circle cx="12" cy="14" r="2" fill={color} opacity={0.5} />
      {/* Viewfinder bump */}
      <Path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Flash dot */}
      <Circle cx="18" cy="10.5" r="1" fill={color} opacity={0.6} />
    </Svg>
  );
}
