module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);

  const isTest = process.env.NODE_ENV === 'test';

  const plugins = [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: { '@': './src' },
      },
    ],
  ];

  // react-native-reanimated/plugin requires native tooling; add only outside Jest.
  if (!isTest) {
    plugins.push('react-native-reanimated/plugin');
  }

  return {
    presets: [
      // Disable reanimated auto-inclusion in Jest to avoid missing worklets peer dep.
      ['babel-preset-expo', { reanimated: !isTest }],
    ],
    plugins,
  };
};
