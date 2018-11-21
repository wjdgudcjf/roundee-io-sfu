import DS from 'ember-data';

const {Model, attr} = DS;

var Logmsg = Model.extend({
    keyID: attr('string'),
    seqID: attr('string'),
    roomID: attr('string'),
    msgID: attr('string'),
    sender: attr('string'),
    senderName: attr('string'),
    isMyMsg: attr('number', {defaultValue:0}),
    msgDateTime: attr('string'),
    msgUnreadMemberCount: attr('number', {defaultValue:0}),
    msgType: attr('string'),
    msgData: attr('string'),
    thumbnailUrl: attr('string'),
    fileName: attr('string'),
    recordmsg: attr(''),    //{start_rec_time: '', msgtime: (now - start_rec_time)}
    recordtimer: attr('string'),
});

export default Logmsg;
