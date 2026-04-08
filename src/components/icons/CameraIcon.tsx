import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type CameraIconProps = {
  size?: number;
  color?: string;
};

export default function CameraIcon({ size = 24, color = '#ffffff' }: CameraIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Narrow filled top bump */}
      <Path d="M9.5 7V5.8A1.3 1.3 0 0 1 10.8 4.5h2.4A1.3 1.3 0 0 1 14.5 5.8V7Z" fill={color} />
      {/*
        Camera body with a negative lens cutout.
        Two subpaths with fillRule="evenodd":
          1. Body rect (M4 7 … Z)
          2. Lens circle (M16 13.5 … Z) — punches a hole
      */}
      <Path
        d="M4 7H20A2 2 0 0 1 22 9V18A2 2 0 0 1 20 20H4A2 2 0 0 1 2 18V9A2 2 0 0 1 4 7Z M16 13.5A4 4 0 0 0 8 13.5A4 4 0 0 0 16 13.5Z"
        fill={color}
        fillRule="evenodd"
      />
      {/* Flash indicator */}
      <Circle cx="18.5" cy="9.5" r="0.9" fill={color} opacity={0.6} />
    </Svg>
  );
}
