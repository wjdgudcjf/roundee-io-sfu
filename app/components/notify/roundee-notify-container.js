import {inject as service} from '@ember/service';
import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
    tagName: 'div',
    notify: service('roundee-notify'),
    classNameBindings: ['computedPosition', 'hidden'],

    computedPosition: computed('position', function(){
        let notiContainerStyle = "status";
        if(this.get('position')){
            notiContainerStyle = notiContainerStyle + " " + this.get('position');
        }
        return notiContainerStyle;
    }),

    hidden: computed('notify.noti_containers.[]', function(){
        let result ='';
        if(this.get('chatsts') || this.get('notests')) {
          result = " " + 'openchat';
        }

        let noticount = this.get('notify.noti_containers').length;
        if(noticount>0){
            return "show" + result;
        }
        return "hide";
    })
});
