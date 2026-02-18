/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const mode = (argv && argv.mode) || 'development';
  const isDev = mode === 'development';

  return {
    mode,
    // ── Externals ─────────────────────────────────────────────────────────────
    // Azure DevOps injects its own copy of the SDK into every extension iframe
    // (especially ms.vss-web.external-content / dialog pages). Bundling a second
    // copy causes "SDK already loaded" → the second init() never gets its
    // handshake response → infinite loading spinner.
    //
    // Declaring the SDK as an AMD external lets RequireJS (which ADO uses on
    // every page) provide a single shared instance. Our bundle just receives it
    // as a `define([...])` dependency — no double-load.
    // ── Externals ─────────────────────────────────────────────────────────────
    // Azure DevOps injects its own copy of the SDK into every extension iframe
    // (especially ms.vss-web.external-content / dialog pages). Bundling a second
    // copy causes "SDK already loaded" → the second init() never gets its
    // handshake response → infinite loading spinner.
    //
    // Declaring the SDK as an AMD external lets RequireJS (which ADO uses on
    // every page) provide a single shared instance. Our bundle just receives it
    // as a define([...]) dependency — no double-load.
    externals: {
      'azure-devops-extension-sdk': 'azure-devops-extension-sdk',
    },
    entry: {
      'action/action': './src/action/action.ts',
      'modal/modal': './src/modal/modal.tsx',
      'settings/settings': './src/settings/settings.tsx',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
      // Wrap every bundle in define([...]) so RequireJS (ADO's module loader)
      // can inject the shared SDK instance instead of our own bundled copy.
      library: { type: 'amd' },
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: { transpileOnly: false },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.(scss|css)$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: { sourceMap: isDev },
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: isDev,
                // Use the modern Sass API to suppress the "legacy JS API" deprecation warning
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
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/action/index.html',
        filename: 'action/index.html',
        chunks: ['action/action'],
        inject: true,
      }),
      new HtmlWebpackPlugin({
        template: './src/modal/index.html',
        filename: 'modal/index.html',
        chunks: ['modal/modal'],
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
    performance: {
      hints: isDev ? false : 'warning',
      maxEntrypointSize: 1024 * 1024,
      maxAssetSize: 1024 * 1024,
    },
    // ── Dev server (used only with `npm run serve`) ──────────────────────────
    devServer: {
      port: 3000,
      // HTTPS required: Azure DevOps pages are served over HTTPS, so any
      // iframe content must also be HTTPS (mixed-content rules).
      // On first launch, Chrome will warn about the self-signed certificate.
      // Navigate to https://localhost:3000 once and click "Advanced → Proceed".
      server: 'https',
      static: {
        directory: path.resolve(__dirname, 'dist'),
        publicPath: '/',
      },
      headers: {
        // Allow Azure DevOps (*.visualstudio.com / dev.azure.com) to embed
        // this content in iframes.
        'Access-Control-Allow-Origin': '*',
        // Relax the frame-ancestors CSP for local dev only.
        'Content-Security-Policy': "frame-ancestors 'self' https://*.visualstudio.com https://dev.azure.com https://*.azure.com",
      },
      hot: false,       // Extensions do not support HMR; manual refresh works fine.
      liveReload: false,
      compress: true,
      client: false,    // Disable the webpack-dev-server overlay inside iframes.
      allowedHosts: 'all',
    },
  };
};
