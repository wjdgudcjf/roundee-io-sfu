import DS from 'ember-data';

const {Model, attr} = DS;

let member = Model.extend({
    userid: attr('string'),
    type: attr('number', {defaultvalue: 0}),                       // 0: general, 1: viewer
    displayname: attr('string'),
    email: attr('string'),
    state: attr('string'),
    quality: attr('string', {defaultvalue: 'high'}),
    mstate: attr('string', {defaultvalue: 'all'}),               // all, audioonly, videoonly, none
    operation: attr('string', {defaultvalue: ''}),
    devicetype: attr('string', {defaultvalue: 'pc'}),
    devicestatus: attr('string', {defaultvalue: 'all'}),
    incommingvideo: attr('boolean', {defaultvalue: true})
});

export default member;
