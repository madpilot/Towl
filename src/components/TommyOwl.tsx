import React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { Colors } from '@/theme';

type TommyOwlProps = {
  size?: number;
}

const MINT = Colors.mint;
const MINT_BG = Colors.mintBg;
const YELLOW = Colors.yellow;

export default function TommyOwl({ size = 90 }: TommyOwlProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 176 176" fill="none">
      {/* Ear tufts */}
      <Path d="M70 68 Q64 50 72 44 Q76 58 78 66Z" fill={MINT_BG} stroke={MINT} strokeWidth="2.5" strokeLinejoin="round" />
      <Path d="M106 68 Q112 50 104 44 Q100 58 98 66Z" fill={MINT_BG} stroke={MINT} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Body */}
      <Circle cx="88" cy="100" r="62" fill={MINT_BG} stroke={MINT} strokeWidth="3" />
      {/* Chest feathers */}
      <Ellipse cx="88" cy="103" rx="44" ry="40" fill="none" stroke={MINT} strokeWidth="1.8" opacity="0.35" />
      {/* Left eye */}
      <Circle cx="70" cy="97" r="16" fill="white" stroke={MINT} strokeWidth="2.6" />
      <Circle cx="70" cy="97" r="9" fill={MINT} />
      <Circle cx="73" cy="93" r="3" fill="white" />
      {/* Right eye */}
      <Circle cx="106" cy="97" r="16" fill="white" stroke={MINT} strokeWidth="2.6" />
      <Circle cx="106" cy="97" r="9" fill={MINT} />
      <Circle cx="109" cy="93" r="3" fill="white" />
      {/* Beak */}
      <Path d="M82 113 Q88 124 94 113 Q88 109 82 113Z" fill={YELLOW} stroke={MINT} strokeWidth="2.2" strokeLinejoin="round" />
    </Svg>
  );
}
