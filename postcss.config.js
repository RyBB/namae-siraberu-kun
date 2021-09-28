module.exports = {
  plugins: [
    require('autoprefixer')({
      overrideBrowserslist: ['last 2 versions', 'ie >= 11', 'Android >= 4'],
    }),
  ],
};
