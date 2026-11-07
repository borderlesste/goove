import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatPromoActiveAt} from '../src/dateTime.js';

test('formats the server selection time in Eastern time with timezone label',()=>{
 assert.equal(formatPromoActiveAt('2026-10-17T03:16:47.957Z'),'Oct 16, 2026, 11:16 PM EDT');
});

test('rejects a missing or invalid reservation timestamp instead of creating a bad WhatsApp message',()=>{
 assert.throws(()=>formatPromoActiveAt(undefined),/valid selection time/);
 assert.throws(()=>formatPromoActiveAt('not a date'),/valid selection time/);
});
