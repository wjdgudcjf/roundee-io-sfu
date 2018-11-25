import { inject as service } from '@ember/service';
import { computed } from '@ember/object';
import Component from '@ember/component';
import config from '../../config/environment';

export default Component.extend({
    store: service('store'),
    session: service('roundee-auth'),
    tagName: 'div',
    ischrome: false,
    isfirefox: false,
    isopera: false,
    issafari: false,
    devicesetting: true,

    browserchecking: computed(function(){
        if(config.APP.browsertype==='chrome') {
          this.set('ischrome', true);
        }
        else if(config.APP.browsertype==='opera') {
          this.set('isopera', true);
        }
        else if(config.APP.browsertype==='firefox') {
          this.set('isfirefox', true);
        }
        else if(config.APP.browsertype==='safari') {
          this.set('issafari', true);
        }
    }),

    didInsertElement() {
        this._super(...arguments);
        sessionStorage.clear();
    },

    actions: {
      refreshBrowser(){
          location.reload(true);
      }
    }
});
