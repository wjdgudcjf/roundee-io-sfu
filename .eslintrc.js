module.exports = {
    root: true,
    parserOptions: {
        ecmaVersion: 2017,
        sourceType: 'module'
    },
    plugins: [
        'ember'
    ],
    extends: [
        'eslint:recommended',
        'plugin:ember/recommended'
    ],
    env: {
        browser: true,
        commonjs: true,
        es6: true,
        jquery: true
    },
    rules: {
        "no-mixed-spaces-and-tabs": ["off", "smart-tabs"],
        "no-unused-vars": ["off"],
        "no-useless-escape": ["off"],
        "no-console":["off"],
        "ember/no-global-jquery": ["off"],
        "no-triple-curlies": ["off"]
    },
    globals:{
        "CONST": true,
        "GLOBAL": true,
        "ucEngine":  true,
        "ucEngineWeb": true,
        "LOCALE": true,
        "CryptoJS": true,
        "GLOBAL_MODULE": true,
        'jstz': true,
        "adapter": true
    },
    overrides: [
        // node files
        {
            files: [
                '.template-lintrc.js',
                'ember-cli-build.js',
                'testem.js',
                'blueprints/*/index.js',
                'config/**/*.js',
                'lib/*/index.js'
            ],
            parserOptions: {
                sourceType: 'script',
                ecmaVersion: 2015
            },
            env: {
                browser: false,
                node: true
            }
        }
    ]
};
