import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shuffleProductIds,PRODUCT_RETURN_DELAY} from '../src/productShuffle.js';
test('product shuffle preserves IDs and input, and avoids repeating the previous full order',()=>{
 const source=['a','b','c','d'];
 const result=shuffleProductIds(source,[],()=>0);
 assert.deepEqual(source,['a','b','c','d']);
 assert.deepEqual([...result].sort(),source);
 const again=shuffleProductIds(source,result,()=>0);
 assert.notDeepEqual(again,result);
 assert.deepEqual([...again].sort(),source);
 assert.deepEqual(shuffleProductIds([],[],()=>0),[]);
 assert.deepEqual(shuffleProductIds(['only'],['only'],()=>0),['only']);
 assert.equal(PRODUCT_RETURN_DELAY,300000);
});
