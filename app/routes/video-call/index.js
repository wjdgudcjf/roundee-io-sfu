import { inject as service } from '@ember/service';
import RSVP from 'rsvp';
import Route from '@ember/routing/route';

export default Route.extend({
    store: service('store'),
    session: service('roundee-auth'),

    model(){
        let roomid = GLOBAL_MODULE.getConfID();
        GLOBAL.error('GetMyID = ' + GLOBAL.getMyID());
        return RSVP.hash({
            roominfo: this.get('store').peekRecord('conferenceroom', roomid),
            members: this.get('store').peekAll('member'),
            myinfo: this.get('store').peekRecord('member', GLOBAL.getMyID()),
            chatdata: this.get('store').peekAll('logmsg'),
            notesdata: this.get('store').peekAll('notes'),
            recordings: this.get('store').peekAll('recording')
        });
    },

    // actions
    actions: {
        /* Modal Open & Close*/
        openModal: function(modalName, model, object, handle) {
            this.controllerFor(modalName).set('model', '');
            this.controllerFor(modalName).set('model', model);
            this.controllerFor(modalName).set('object', object);
            this.controllerFor(modalName).set('handle', handle);

            return this.render(modalName, {
                into: 'video-call.index',
                outlet: 'modal'
            });
        },
        closeModal: function() {
            // 다른 Popup창이 같이 다니는 경우가 있어 disconnectOut을 사용하지 않고, None Popup으로 대체함.
            return this.render('popup.nothing-popup', {
                into: 'video-call.index',
                outlet: 'modal'
            });
        },
    }
});
