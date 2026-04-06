import React from 'react';
import Svg, { Path } from 'react-native-svg';

type HouseIconProps = {
  color: string;
  size?: number;
};

export default function HouseIcon({ color, size = 24 }: HouseIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Roof */}
      <Path
        d="M3 10.5L12 3l9 7.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Walls */}
      <Path
        d="M5 9v10a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
