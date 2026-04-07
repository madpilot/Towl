import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

type CameraIconProps = {
  size?: number;
  color?: string;
};

export default function CameraIcon({ size = 24, color = '#ffffff' }: CameraIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Narrow filled top bump — clearly a viewfinder, not a handle */}
      <Path d="M9.5 7V5.8A1.3 1.3 0 0 1 10.8 4.5h2.4A1.3 1.3 0 0 1 14.5 5.8V7Z" fill={color} />
      {/* Camera body */}
      <Rect x="2" y="7" width="20" height="13" rx="2" fill={color} opacity={0.9} />
      {/* Lens ring */}
      <Circle cx="12" cy="13.5" r="3.8" stroke={color} strokeWidth="1.5" fill="none" opacity={0.45} />
      {/* Lens centre */}
      <Circle cx="12" cy="13.5" r="2" fill={color} opacity={0.45} />
      {/* Flash indicator */}
      <Circle cx="18.5" cy="9.5" r="0.9" fill={color} opacity={0.6} />
    </Svg>
  );
}
