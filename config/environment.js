'use strict';

module.exports = function(environment) {
  let ENV = {
    modulePrefix: 'roundee-io-sfu',
    environment,
    rootURL: '/openvc/',
    locationType: 'auto',
    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. 'with-controller': true
      },
      EXTEND_PROTOTYPES: {
        // Prevent Ember Data from overriding Date.parse.
        Date: false
      }
    },

    APP: {
        // Here you can pass flags/options to your application instance
        // when it is created
        domain: 'https://www.roundee.io',
        engine_server_url: 'www.roundee.io',
        engine_server_protorol_type: 'wss://',
        engine_server_port: '7060',
        uploadsvrurl: 'www.roundee.io',
        version: "3.0.0",
        browsertype: "chrome",
        devicetype: 'pc'
    }
  };

  if (environment === 'development') {
        // ENV.APP.LOG_RESOLVER = true;
        // ENV.APP.LOG_ACTIVE_GENERATION = true;
        // ENV.APP.LOG_TRANSITIONS = true;
        // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
        // ENV.APP.LOG_VIEW_LOOKUPS = true;


        ENV.APP.domain = 'https://askee.io';
        ENV.APP.engine_server_url = 'dev0.roundee.com';
        ENV.APP.engine_server_protorol_type = 'wss://';
        ENV.APP.engine_server_port = '7060';
        ENV.APP.uploadsvrurl = 'dev0.roundee.io';
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;
  }

  if (environment === 'production') {
    // here you can enable a production-specific feature
  }

  return ENV;
};
