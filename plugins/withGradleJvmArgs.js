// plugins/withGradleJvmArgs.js
const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    config.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx6144m -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8' });
    config.modResults.push({ type: 'property', key: 'org.gradle.daemon', value: 'true' });
    config.modResults.push({ type: 'property', key: 'org.gradle.parallel', value: 'true' });
    config.modResults.push({ type: 'property', key: 'android.lint.checkReleaseBuilds', value: 'false' });
    return config;
  });
};
