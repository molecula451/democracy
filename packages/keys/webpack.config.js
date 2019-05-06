const path = require('path');
const npm_package = require('./package.json')
const HtmlWebPackPlugin = require('html-webpack-plugin')

module.exports = {
  entry: [
    './src/index.js',
   // path.resolve(__dirname, 'dist', 'keythereum.min.js')
  ],
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"]
          }
        }
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: "html-loader"
          }
        ]
      }
    ]
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  externals: {
    "keythereum": "keythereum"
  },
  node: {
    fs: "empty"
  },
  resolve: {
    alias: {
     //'keythereum': require.resolve('keythereum'),
    }
  },
  plugins: [
    new HtmlWebPackPlugin({
      template: "./src/index.html",
      filename: "./index.html"
    }),
  ]
};
