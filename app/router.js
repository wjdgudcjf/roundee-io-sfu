import EmberRouter from '@ember/routing/router';
import config from './config/environment';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(function() {
  this.route('sign-in', function() {
      this.route('index', {path: '/'});
  });

  this.route('video-call', function() {
      this.route('index', {path: '/:roomid'});
  });

  this.route('not-found', { path: '/*path' });

  this.route('popup', function() {});
});

export default Router;
