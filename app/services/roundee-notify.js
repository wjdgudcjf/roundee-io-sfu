import Service from '@ember/service';
import Object from '@ember/object';
import {isEmpty, typeOf} from '@ember/utils';
import {later, cancel} from '@ember/runloop';

export default Service.extend({
    noti_containers: null,
    defaultClearDuration: 5000,
    defaultAutoClear: false,

    init(){
        this._super(...arguments);
        this.noti_containers = [];
    },

    addNotification(options) {
        // If no message is set, throw an error
        if (!options.message) {
            throw new Error("No notification message set");
        }

        const notification = Object.create({
            message: options.message,
            type: options.type || 'info', // info, success, warning, error
            autoClear: (isEmpty(options.autoClear) ? this.get('defaultAutoClear') : options.autoClear),
            clearDuration: options.clearDuration || this.get('defaultClearDuration'),
            onClick: options.onClick,
            htmlContent: options.htmlContent || false,
            cssClasses: options.cssClasses,
            title: options.title
        });

        this.get('noti_containers').pushObject(notification);

        if (notification.autoClear) {
            notification.set('remaining', notification.get('clearDuration'));
            this.setupAutoClear(notification);
        }



        return notification;
    },

    // Helper methods for each type of notification

    info(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'info';
        this.addNotification(notiobject);
    },

    recinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'recinfo';
        this.addNotification(notiobject);
    },

    refreshinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'refreshinfo';
        this.addNotification(notiobject);
    },

    recstopinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'recstopinfo';
        this.addNotification(notiobject);
    },

    recotheruserinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'recotheruserinfo';
        this.addNotification(notiobject);
    },

    recsaveinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'recsaveinfo';
        this.addNotification(notiobject);
    },

    settingsavedinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'settingsavedinfo';
        this.addNotification(notiobject);
    },

    msginfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'msginfo';
        this.addNotification(notiobject);
    },

    noteaddinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'noteaddinfo';
        this.addNotification(notiobject);
    },

    notenorecaddinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'notenorecaddinfo';
        this.addNotification(notiobject);
    },

    chatinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'chatinfo';
        this.addNotification(notiobject);
    },

    networkinfo(message, options) {
        let notiobject = options;
        if(options===undefined||options===null){
            notiobject = {};
        }
        notiobject.message =  message;
        notiobject.type = 'networkinfo';
        this.addNotification(notiobject);
    },

    removeNotification(notification) {
        if (!notification) {
            return;
        }
        notification.set('dismiss', true);
        // Delay removal from DOM for dismissal animation
        later(this, () => {
            this.get('noti_containers').removeObject(notification);
        }, 500);
    },

    setupAutoClear(notification) {
        notification.set('startTime', Date.now());

        const timer = later(this, () => {
            // Hasn't been closed manually
            if (this.get('noti_containers').indexOf(notification) >= 0) {
                this.removeNotification(notification);
            }
        }, notification.get('remaining'));

        notification.set('timer', timer);
    },

    pauseAutoClear(notification) {
        cancel(notification.get('timer'));

        const elapsed = Date.now() - notification.get('startTime');
        const remaining = notification.get('clearDuration') - elapsed;
        notification.set('remaining', remaining);
    },

    clearAll() {
        this.get('noti_containers').forEach(notification => {
            this.removeNotification(notification);
        });
    },

    setDefaultAutoClear(autoClear) {
        if (typeOf(autoClear) !== 'boolean') {
            throw new Error('Default auto clear preference must be a boolean');
        }

        this.set('defaultAutoClear', autoClear);
    },

    setDefaultClearDuration(clearDuration) {
        if (typeOf(clearDuration) !== 'number') {
            throw new Error('Clear duration must be a number');
        }

        this.set('defaultClearDuration', clearDuration);
    }
});
