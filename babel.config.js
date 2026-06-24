module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        { unstable_transformImportMeta: true }
      ]
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            'moti/skeleton': 'moti/skeleton/react-native-linear-gradient',
          },
        },
      ],
      'nativewind/babel',
      'react-native-reanimated/plugin', // ✅ Restored to the official plugin
    ],
  };
};