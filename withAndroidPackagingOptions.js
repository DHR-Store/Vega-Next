const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidPackagingOptions = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let buildGradle = config.modResults.contents;

      // Check if the setting is already there to avoid duplicates during multiple builds
      if (!buildGradle.includes('useLegacyPackaging = false')) {
        
        // This regex finds the opening of the android { block
        const androidBlockRegex = /android\s*\{/;
        
        // The configuration block we want to inject
        const packagingOptionsBlock = `
    packagingOptions {
        jniLibs {
            useLegacyPackaging = false
        }
    }
`;
        
        // Inject our block right after 'android {'
        buildGradle = buildGradle.replace(androidBlockRegex, `android {${packagingOptionsBlock}`);
        
        // Reassign the modified contents back to the Expo build pipeline
        config.modResults.contents = buildGradle;
      }
    }
    return config;
  });
};

module.exports = withAndroidPackagingOptions;