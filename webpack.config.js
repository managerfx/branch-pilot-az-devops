/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const mode = (argv && argv.mode) || 'development';
  const isDev = mode === 'development';

  // ── Shared rules ──────────────────────────────────────────────────────────
  const sharedModule = {
    rules: [
      {
        test: /\.tsx?$/,
        use: { loader: 'ts-loader', options: { transpileOnly: false } },
        exclude: /node_modules/,
      },
      {
        test: /\.(scss|css)$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { sourceMap: isDev } },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: isDev,
              sassOptions: { silenceDeprecations: ['legacy-js-api'] },
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|gif|svg|woff|woff2|eot|ttf)$/,
        type: 'asset/inline',
      },
    ],
  };

  const sharedResolve = { extensions: ['.ts', '.tsx', '.js', '.jsx'] };
  const sharedPerformance = {
    hints: isDev ? false : 'warning',
    maxEntrypointSize: 1024 * 1024,
    maxAssetSize: 1024 * 1024,
  };

  // ── Config 1: action + settings ───────────────────────────────────────────
  // These pages run in iframes where ADO does NOT inject the SDK; we bundle it.
  const mainConfig = {
    name: 'main',
    mode,
    entry: {
      'action/action': './src/action/action.ts',
      'settings/settings': './src/settings/settings.tsx',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
    resolve: sharedResolve,
    module: sharedModule,
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/action/index.html',
        filename: 'action/index.html',
        chunks: ['action/action'],
        inject: true,
      }),
      new HtmlWebpackPlugin({
        template: './src/settings/index.html',
        filename: 'settings/index.html',
        chunks: ['settings/settings'],
        inject: true,
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'assets'),
            to: path.resolve(__dirname, 'dist/assets'),
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    devtool: isDev ? 'inline-source-map' : false,
    performance: sharedPerformance,
    // ── Dev server ────────────────────────────────────────────────────────
    devServer: {
      port: 3000,
      server: 'https',
      static: {
        directory: path.resolve(__dirname, 'dist'),
        publicPath: '/',
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Security-Policy':
          "frame-ancestors 'self' https://*.visualstudio.com https://dev.azure.com https://*.azure.com",
      },
      hot: false,
      liveReload: false,
      compress: true,
      client: false,
      allowedHosts: 'all',
    },
  };

  // ── Config 2: modal ───────────────────────────────────────────────────────
  // ms.vss-web.external-content (dialog) iframes: ADO injects SDK.min.js AND
  // provides RequireJS with azure-devops-extension-sdk registered.
  // Declaring the SDK as an AMD external prevents the double-load that causes
  // "SDK already loaded" → hung init() → infinite loading spinner.
  const modalConfig = {
    name: 'modal',
    mode,
    entry: { 'modal/modal': './src/modal/modal.tsx' },
    externals: {
      'azure-devops-extension-sdk': 'azure-devops-extension-sdk',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      library: { type: 'amd' },
    },
    resolve: sharedResolve,
    module: sharedModule,
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/modal/index.html',
        filename: 'modal/index.html',
        chunks: ['modal/modal'],
        inject: true,
      }),
    ],
    devtool: isDev ? 'inline-source-map' : false,
    performance: sharedPerformance,
  };

  return [mainConfig, modalConfig];
};
