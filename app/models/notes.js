import DS from 'ember-data';

const {Model, attr} = DS;

var notes = Model.extend({
    keyID: attr('string'),
    noteID: attr('string'),
    seqID: attr('string'),
    noteMsg: attr('string'),
    noteTimer: attr('string'),
    noteType: attr('string')
});

export default notes;
