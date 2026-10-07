export const palette = {
  sky: 0xbfe3f7,
  fog: 0xcfe8f8,

  asphalt: 0x4b5058,
  asphaltDark: 0x3f444b,
  asphaltWear: 0x555b64,
  marking: 0xf2f4f6,
  markingYellow: 0xe8c65a,

  sidewalk: 0x9aa1ab,
  sidewalkDark: 0x8b929c,
  curb: 0xbcc2ca,

  grass: 0x6da055,
  grassDark: 0x5d8f49,
  dirt: 0x7a5f42,

  roofDark: 0x3d4148,
  roofBrown: 0x6b4a36,
  chimney: 0x8a5a3b,

  wallOrange: 0xd96b3a,
  wallOrangeDark: 0xb4562d,
  wallMint: 0xa7d9c4,
  wallMintDark: 0x8cc2ab,
  wallCream: 0xf0e3c0,
  wallCreamDark: 0xd8c9a3,
  wallBlue: 0xa9c8e6,
  wallBlueDark: 0x8dafd1,
  wallButter: 0xf2d98c,
  wallButterDark: 0xd8bd6f,
  wallRose: 0xe8b4a8,
  wallRoseDark: 0xcc998d,
  wallWhite: 0xf7f4ec,

  frame: 0xf7f4ec,
  glass: 0x2f4a63,
  glassLight: 0x6fa8d6,
  doorWood: 0x8a5a3b,
  signBoard: 0x2d3142,

  awningRed: 0xd94848,
  awningGreen: 0x2f8f5b,
  awningTeal: 0x2f8f8f,
  awningBlue: 0x4a7fd9,
  awningWhite: 0xf5f0e6,

  shelter: 0x2e6b52,
  shelterDark: 0x245741,
  shelterGlass: 0xa8ccd6,

  poleDark: 0x2b2f36,
  lampWhite: 0xfdf6d8,
  lampOff: 0x3a3f47,

  lightRedOn: 0xff4d3d,
  lightRedOff: 0x1a0a08,
  lightYellowOn: 0xffc93c,
  lightYellowOff: 0x1a1508,
  lightGreenOn: 0x3ce06e,
  lightGreenOff: 0x0a1a0e,

  trash: 0x3f6b4a,
  hydrant: 0xc94f3d,
  bench: 0x9a6a44,
  planter: 0x8a6a4a,

  trunk: 0x7a5230,
  leaf: 0x4c9e4c,
  leafLight: 0x66b95c,
  leafDark: 0x3d8640,

  busYellow: 0xe9b62c,
  busYellowDark: 0xc79a24,
  busWhite: 0xf2f2ee,
  busBumper: 0x2f333a,

  carRed: 0xd94a4a,
  carBlue: 0x4a7fd9,
  carYellow: 0xe8c65a,
  carGray: 0x9aa1ab,
  carGreen: 0x63b06a,
  carWhite: 0xf2f2ee,
  carTire: 0x22252a,
  carGlass: 0x27415c,

  flowerGreen: 0x4caf50,
  flowerRed: 0xe04a4a,
  flowerYellow: 0xe8c65a,
  flowerPink: 0xe58fb4,
  flowerWhite: 0xf5f0e6,

  skin: [0xf0c8a0, 0xd9a06b, 0xa9714a, 0x8a5535, 0x6b3f28],
  shirt: [0xd94a4a, 0x4a7fd9, 0x63b06a, 0xe8c65a, 0xe58fb4, 0x8a5ac2, 0xf2f2ee, 0x2f8f8f, 0xd97a3a, 0x3d4148],
  pants: [0x3d4148, 0x2f4a63, 0x6b4a36, 0x555b64, 0x5d3f6b],
  hair: [0x2b2119, 0x4a3423, 0x8a5a3b, 0xd9c07a, 0x555b64, 0x8a2f2f],
} as const;

export type FlowerColor = (typeof palette)['flowerGreen'];
