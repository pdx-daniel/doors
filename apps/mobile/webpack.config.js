const path = require('node:path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

const appRoot = __dirname
const monorepoRoot = path.resolve(appRoot, '../..')

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: path.join(appRoot, 'index.web.js'),
  output: {
    path: path.join(appRoot, 'web-dist'),
    filename: 'bundle.js',
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      '@': path.join(appRoot, 'src'),
      '@doors/api': path.join(monorepoRoot, 'packages/api/src/index.ts'),
      '@doors/server': path.join(monorepoRoot, 'apps/server/src/app.ts'),
      // Prefer the web map implementation when bundling for the browser.
      [path.join(appRoot, 'src/components/MapView')]: path.join(
        appRoot,
        'src/components/MapView.web.tsx',
      ),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        include: [
          appRoot,
          path.resolve(monorepoRoot, 'packages/api'),
          /node_modules[/\\](@doors|nativewind|react-native-css|@gluestack-ui)/,
          /node_modules[/\\]\.bun[/\\]@gluestack-ui[^/\\]+[/\\]node_modules[/\\]@gluestack-ui/,
        ],
        use: {
          loader: 'babel-loader',
          options: {
            envName: 'web',
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(appRoot, 'public/index.html'),
    }),
    new webpack.DefinePlugin({
      'process.env.DOORS_API_URL': JSON.stringify(
        process.env.DOORS_API_URL ?? 'http://localhost:3000',
      ),
    }),
    // Copy basemap assets into web-dist for production builds (dev server serves public/ directly).
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(appRoot, 'public/basemaps'),
          to: 'basemaps',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  devServer: {
    static: {
      directory: path.join(appRoot, 'public'),
    },
    port: 3001,
    hot: true,
    historyApiFallback: true,
  },
}
