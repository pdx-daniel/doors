const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const appRoot = __dirname;
const monorepoRoot = path.resolve(appRoot, '../..');

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
      '@doors/api': path.join(monorepoRoot, 'packages/api/src/index.ts'),
      '@doors/server': path.join(monorepoRoot, 'apps/server/src/app.ts'),
      // Prefer the web map implementation when bundling for the browser.
      [path.join(appRoot, 'src/components/MapView')]: path.join(
        appRoot,
        'src/components/MapView.web.tsx',
      ),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules\/(?!(@doors)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            envName: 'web',
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
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
  ],
  devServer: {
    static: {
      directory: path.join(appRoot, 'public'),
    },
    port: 3001,
    hot: true,
    historyApiFallback: true,
  },
};
