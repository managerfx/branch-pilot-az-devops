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

  const sharedResolve = { 
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    // CRITICAL: Force all modules to use the same instance of SDK and API
    // This prevents the "SDK is already loaded" error caused by azure-devops-extension-api
    // importing its own copy of the SDK
    alias: {
      'azure-devops-extension-sdk': path.resolve(__dirname, 'node_modules/azure-devops-extension-sdk'),
      'azure-devops-extension-api': path.resolve(__dirname, 'node_modules/azure-devops-extension-api'),
    },
  };
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
  // ms.vss-web.external-content (dialog) iframes. Bundle the SDK since Azure
  // DevOps doesn't provide it in this context. The warning about duplicate SDK
  // is cosmetic - what matters is that init() completes successfully.
  const modalConfig = {
    name: 'modal',
    mode,
    entry: { 'modal/modal': './src/modal/modal.tsx' },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
    resolve: sharedResolve,
    module: sharedModule,
    optimization: {
      // Prevent code splitting that might load SDK multiple times
      splitChunks: false,
      runtimeChunk: false,
    },
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
